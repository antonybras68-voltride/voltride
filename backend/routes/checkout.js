const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const { sendEmail, generateInvoicePDF, getInvoiceEmailTemplate } = require('../services/emailService');

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
        a.name as agency_name
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.status = 'active'
        AND ($1::int IS NULL OR r.agency_id = $1)
      ORDER BY r.start_date DESC
    `, [agency_id || null]);
    
    res.json(result.rows);
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
      ticket_photo,
      checkout_photos
    } = req.body;
    
    // 1. Récupérer les infos de la location
    const rentalInfo = await client.query(`
      SELECT r.*, c.email, c.first_name, c.last_name, c.preferred_language,
             v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
    `, [rental_id]);
    
    if (rentalInfo.rows.length === 0) {
      throw new Error('Location non trouvée');
    }
    
    const rental = rentalInfo.rows[0];
    
    // 2. Mettre à jour la location
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
        checkout_notes = $7
      WHERE id = $8
    `, [
      now,
      total_deductions,
      deposit_refunded,
      refund_method,
      JSON.stringify(inspection),
      ticket_photo,
      deductions.map(d => `${d.description}: -${d.amount}€`).join(', '),
      rental_id
    ]);
    
    // 3. Mettre à jour le statut du véhicule
    const newVehicleStatus = needs_maintenance ? 'maintenance' : 'available';
    
    await client.query(`
      UPDATE vehicles 
      SET status = $1
      WHERE id = $2
    `, [newVehicleStatus, vehicle_id]);
    
    // 4. Enregistrer les déductions
    if (total_deductions > 0) {
      const user = req.user;
      
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
    
    // 5. Envoyer l'email avec la facture PDF (async)
    if (rental.email) {
      sendInvoiceEmailWithPDF(pool, rental_id, rental, total_deductions, deposit_refunded, deductions)
        .catch(err => console.error('Erreur envoi email facture:', err));
    }
    
    res.json({
      success: true,
      message: 'Check-out completado con éxito',
      rental_id: rental_id,
      invoice_url: `/api/invoices/${rental_id}/pdf`,
      deposit_refunded: deposit_refunded,
      vehicle_status: newVehicleStatus
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en check-out:', error);
    res.status(500).json({ error: 'Error al procesar el check-out: ' + error.message });
  } finally {
    client.release();
  }
});

// Fonction pour envoyer l'email de facture avec PDF
async function sendInvoiceEmailWithPDF(pool, rentalId, rental, total_deductions, deposit_refunded, deductions) {
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
    deductions: total_deductions,
    deposit_refunded: deposit_refunded.toFixed(2)
  };
  
  const template = getInvoiceEmailTemplate(emailData, lang);
  
  // Préparer les pièces jointes
  const attachments = [];
  if (pdfBase64) {
    attachments.push({
      filename: `factura-${rental.contract_number}.pdf`,
      content: pdfBase64
    });
  }
  
  const result = await sendEmail({
    to: rental.email,
    subject: template.subject,
    html: template.html,
    attachments: attachments
  });
  
  if (result.success) {
    console.log(`✅ Email facture + PDF envoyé à ${rental.email}`);
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
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
