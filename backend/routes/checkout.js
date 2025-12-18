const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const { sendEmail, generateInvoicePDF, getInvoiceEmailTemplate } = require('../services/emailService');

// Types de véhicules motorisés (nécessitent km)
const MOTORIZED_TYPES = ['scooter', 'e-motocross', 'emotocross', 'e_motocross', 'moto', 'motocross'];

// Seuils de maintenance
const MAINTENANCE_THRESHOLDS = {
  km: 1000,        // Motos : maintenance tous les 1000 km
  days: 10         // Vélos/E-bikes : maintenance tous les 10 jours cumulés
};

// Vérifier si le type de véhicule est motorisé
function isMotorizedVehicle(type) {
  if (!type) return false;
  const normalizedType = type.toLowerCase().replace(/[-_\s]/g, '');
  return MOTORIZED_TYPES.some(t => normalizedType.includes(t.replace(/[-_\s]/g, '')));
}

// GET /api/checkout/active - Obtenir les contrats actifs pour check-out
router.get('/active', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  
  try {
    const { agency_id } = req.query;
    
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.preferred_language,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model, v.color,
        v.current_km, v.license_plate, v.chassis_number,
        a.name as agency_name
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.status = 'active'
        AND ($1::int IS NULL OR r.agency_id = $1)
      ORDER BY r.start_date DESC
    `, [agency_id || null]);
    
    // Ajouter un flag pour savoir si c'est un véhicule motorisé
    const contracts = result.rows.map(r => ({
      ...r,
      is_motorized: isMotorizedVehicle(r.vehicle_type),
      requires_km: isMotorizedVehicle(r.vehicle_type)
    }));
    
    res.json(contracts);
  } catch (error) {
    console.error('Error getting active contracts:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/checkout - Finaliser un check-out
router.post('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      rental_id,
      vehicle_id,
      deductions,
      total_deductions,
      deposit_refunded,
      refund_method,
      inspection,
      needs_maintenance,
      maintenance_reason,
      ticket_photo,
      checkout_photos,
      end_km  // Nouveau: km de fin pour motos
    } = req.body;
    
    // 1. Récupérer les infos de la location et du véhicule
    const rentalInfo = await client.query(`
      SELECT r.*, c.email, c.first_name, c.last_name, c.preferred_language,
             v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
             v.current_km, v.total_rental_days, v.last_maintenance_km, v.last_maintenance_date,
             a.name as agency_name, a.phone as agency_phone, a.email as agency_email
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rental_id]);
    
    if (rentalInfo.rows.length === 0) {
      throw new Error('Location non trouvée');
    }
    
    const rental = rentalInfo.rows[0];
    const isMotorized = isMotorizedVehicle(rental.vehicle_type);
    
    // 2. Calculer les jours de location
    const startDate = new Date(rental.start_date);
    const endDate = new Date();
    const rentalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    // 3. Calculer les km parcourus (motos)
    let kmTraveled = 0;
    let currentKm = rental.current_km || 0;
    
    if (isMotorized && end_km) {
      kmTraveled = end_km - (rental.start_km || rental.current_km || 0);
      currentKm = end_km;
    }
    
    // 4. Mettre à jour la location
    const now = new Date().toISOString();
    
    await client.query(`
      UPDATE rentals 
      SET 
        status = 'completed',
        end_date = $1,
        checkout_deductions = $2,
        checkout_refund = $3,
        checkout_refund_method = $4,
        checkout_inspection = $5,
        checkout_ticket_photo = $6,
        checkout_notes = $7,
        end_km = $8,
        km_traveled = $9
      WHERE id = $10
    `, [
      now,
      total_deductions,
      deposit_refunded,
      refund_method,
      JSON.stringify(inspection),
      ticket_photo,
      deductions.map(d => `${d.description}: -${d.amount}€`).join(', '),
      isMotorized ? end_km : null,
      isMotorized ? kmTraveled : null,
      rental_id
    ]);
    
    // 5. Mettre à jour les statistiques du véhicule
    const newTotalRentalDays = (rental.total_rental_days || 0) + rentalDays;
    
    await client.query(`
      UPDATE vehicles 
      SET 
        current_km = $1,
        total_rental_days = $2
      WHERE id = $3
    `, [currentKm, newTotalRentalDays, vehicle_id]);
    
    // 6. Vérifier si maintenance programmée nécessaire
    let scheduledMaintenance = false;
    let maintenanceType = null;
    
    if (isMotorized) {
      // Motos: vérifier les km
      const kmSinceLastMaintenance = currentKm - (rental.last_maintenance_km || 0);
      if (kmSinceLastMaintenance >= MAINTENANCE_THRESHOLDS.km) {
        scheduledMaintenance = true;
        maintenanceType = 'scheduled_km';
      }
    } else {
      // Vélos/E-bikes: vérifier les jours cumulés
      const lastMaintenanceDate = rental.last_maintenance_date ? new Date(rental.last_maintenance_date) : null;
      let daysSinceLastMaintenance = newTotalRentalDays;
      
      if (lastMaintenanceDate) {
        // Calculer les jours de location depuis la dernière maintenance
        // (simplifié: on regarde le total des jours)
        const rentalsAfterMaintenance = await client.query(`
          SELECT COALESCE(SUM(
            GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(end_date, NOW()) - start_date)) / 86400))
          ), 0) as days
          FROM rentals
          WHERE vehicle_id = $1 
            AND start_date >= $2
            AND status = 'completed'
        `, [vehicle_id, lastMaintenanceDate]);
        
        daysSinceLastMaintenance = parseInt(rentalsAfterMaintenance.rows[0].days) || 0;
      }
      
      if (daysSinceLastMaintenance >= MAINTENANCE_THRESHOLDS.days) {
        scheduledMaintenance = true;
        maintenanceType = 'scheduled_days';
      }
    }
    
    // 7. Déterminer le statut final du véhicule
    const needsMaintenanceNow = needs_maintenance || scheduledMaintenance;
    const newVehicleStatus = needsMaintenanceNow ? 'maintenance' : 'available';
    
    await client.query(`
      UPDATE vehicles 
      SET status = $1
      WHERE id = $2
    `, [newVehicleStatus, vehicle_id]);
    
    // 8. Créer les enregistrements de maintenance si nécessaire
    const user = req.user;
    const maintenanceRecords = [];
    
    // 8a. Problèmes signalés lors de l'inspection
    if (deductions && deductions.length > 0) {
      for (const deduction of deductions) {
        // Créer un ticket de maintenance pour chaque dommage
        if (deduction.description && deduction.amount > 0) {
          const record = await client.query(`
            INSERT INTO maintenance_records 
              (vehicle_id, rental_id, type, priority, description, reported_by, status, photos_before)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            vehicle_id,
            rental_id,
            'repair',
            deduction.amount > 30 ? 'high' : 'normal',
            deduction.description,
            user.id,
            'pending',
            JSON.stringify(checkout_photos?.damages || [])
          ]);
          maintenanceRecords.push(record.rows[0].id);
        }
      }
    }
    
    // 8b. Maintenance programmée
    if (scheduledMaintenance) {
      const description = isMotorized 
        ? `Maintenance programmée: ${currentKm} km atteints (seuil: ${MAINTENANCE_THRESHOLDS.km} km)`
        : `Maintenance programmée: ${newTotalRentalDays} jours cumulés de location (seuil: ${MAINTENANCE_THRESHOLDS.days} jours)`;
      
      await client.query(`
        INSERT INTO maintenance_records 
          (vehicle_id, rental_id, type, priority, description, reported_by, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        vehicle_id,
        rental_id,
        maintenanceType,
        'normal',
        description,
        user.id,
        'pending'
      ]);
    }
    
    // 8c. Problèmes d'inspection nécessitant maintenance (sans déduction)
    if (inspection) {
      const inspectionIssues = [];
      
      if (inspection.wheels === 'crevé') {
        inspectionIssues.push({ desc: 'Pneu crevé', priority: 'high' });
      }
      if (inspection.lights === 'no_funciona') {
        inspectionIssues.push({ desc: 'Éclairage ne fonctionne pas', priority: 'normal' });
      }
      if (inspection.brakes === 'defectuoso') {
        inspectionIssues.push({ desc: 'Freins défectueux', priority: 'high' });
      }
      if (inspection.battery === 'faible') {
        inspectionIssues.push({ desc: 'Batterie faible', priority: 'normal' });
      }
      
      for (const issue of inspectionIssues) {
        await client.query(`
          INSERT INTO maintenance_records 
            (vehicle_id, rental_id, type, priority, description, reported_by, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          vehicle_id,
          rental_id,
          'repair',
          issue.priority,
          issue.desc,
          user.id,
          'pending'
        ]);
      }
    }
    
    // 9. Enregistrer les déductions comme paiement
    if (total_deductions > 0) {
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        rental_id,
        rental.agency_id,
        user.id,
        -total_deductions,
        'deduction',
        'deposit',
        `Deducciones check-out: ${deductions.map(d => d.description).join(', ')}`
      ]);
    }
    
    await client.query('COMMIT');
    
    // 10. Envoyer l'email avec la facture PDF et photo ticket (async)
    if (rental.email) {
      sendInvoiceEmailWithPDF(pool, rental_id, rental, total_deductions, deposit_refunded, deductions, ticket_photo, refund_method)
        .catch(err => console.error('Erreur envoi email facture:', err));
    }
    
    res.json({
      success: true,
      message: 'Check-out completado con éxito',
      rental_id: rental_id,
      invoice_url: `/api/invoices/${rental_id}/pdf`,
      deposit_refunded: deposit_refunded,
      vehicle_status: newVehicleStatus,
      km_traveled: isMotorized ? kmTraveled : null,
      scheduled_maintenance: scheduledMaintenance,
      maintenance_records: maintenanceRecords.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en check-out:', error);
    res.status(500).json({ error: 'Error al procesar el check-out: ' + error.message });
  } finally {
    client.release();
  }
});

// Fonction pour envoyer l'email de facture avec PDF et photo ticket
async function sendInvoiceEmailWithPDF(pool, rentalId, rental, total_deductions, deposit_refunded, deductions, ticket_photo, refund_method) {
  const lang = rental.preferred_language || 'es';
  
  // Générer le PDF de la facture
  const pdfBase64 = await generateInvoicePDF(rentalId, pool);
  
  // Calculer les jours
  const startDate = new Date(rental.start_date);
  const endDate = new Date(rental.end_date || new Date());
  const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
  
  const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const startDateFormatted = startDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'es-ES', dateOptions);
  const endDateFormatted = endDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'es-ES', dateOptions);
  
  const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  const emailData = {
    customer_name: `${rental.first_name} ${rental.last_name}`,
    contract_number: rental.contract_number,
    invoice_number: `F-${rental.contract_number}`,
    vehicle: `${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`,
    start_date: startDateFormatted,
    end_date: endDateFormatted,
    days: days,
    rental_amount: parseFloat(rental.total_amount).toFixed(2),
    deposit_paid: parseFloat(rental.deposit).toFixed(2),
    deductions: total_deductions.toFixed(2),
    deposit_refunded: deposit_refunded.toFixed(2),
    agency_phone: rental.agency_phone,
    agency_email: rental.agency_email
  };
  
  const template = getInvoiceEmailTemplate(emailData, lang);
  
  // Préparer les pièces jointes
  const attachments = [];
  
  // 1. PDF Facture
  if (pdfBase64) {
    attachments.push({
      filename: `factura-${rental.contract_number}.pdf`,
      content: pdfBase64
    });
  }
  
  // 2. Photo du ticket de remboursement (si paiement par carte)
  if (ticket_photo && refund_method === 'preauth') {
    // Extraire le base64 de la data URL
    let ticketBase64 = ticket_photo;
    if (ticket_photo.includes('base64,')) {
      ticketBase64 = ticket_photo.split('base64,')[1];
    }
    
    attachments.push({
      filename: `ticket-devolucion-${rental.contract_number}.jpg`,
      content: ticketBase64
    });
  }
  
  const result = await sendEmail({
    to: rental.email,
    subject: template.subject,
    html: template.html,
    attachments: attachments
  });
  
  if (result.success) {
    console.log(`✅ Email facture + PDF${ticket_photo ? ' + ticket' : ''} envoyé à ${rental.email}`);
  } else {
    console.error(`❌ Erreur envoi email facture à ${rental.email}:`, result.error);
  }
  
  return result;
}

// GET /api/checkout/:rentalId/summary
router.get('/:rentalId/summary', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const { rentalId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        v.current_km, v.license_plate
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const rental = result.rows[0];
    rental.is_motorized = isMotorizedVehicle(rental.vehicle_type);
    rental.requires_km = rental.is_motorized;
    
    res.json(rental);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
