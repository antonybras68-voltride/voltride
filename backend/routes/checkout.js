const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');

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
    
    // 1. Mettre à jour la location (rentals)
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
    
    // 2. Mettre à jour le statut du véhicule
    const newVehicleStatus = needs_maintenance ? 'maintenance' : 'available';
    
    await client.query(`
      UPDATE vehicles 
      SET status = $1
      WHERE id = $2
    `, [newVehicleStatus, vehicle_id]);
    
    // 3. Si maintenance nécessaire, créer un ticket (table future)
    if (needs_maintenance) {
      // Pour l'instant, on log juste
      console.log(`⚠️ Véhicule ${vehicle_id} envoyé en maintenance`);
      
      // TODO: Créer entrée dans table maintenance
      // TODO: Envoyer email au mécanicien et admin
    }
    
    // 4. Enregistrer les déductions comme paiements négatifs (si applicable)
    if (total_deductions > 0) {
      const user = req.user;
      
      // Récupérer agency_id du rental
      const rentalInfo = await client.query('SELECT agency_id FROM rentals WHERE id = $1', [rental_id]);
      const agency_id = rentalInfo.rows[0]?.agency_id;
      
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        rental_id,
        agency_id,
        user.id,
        -total_deductions, // Montant négatif (déduction de la caution)
        'deduction',
        'deposit',
        `Deducciones check-out: ${deductions.map(d => d.description).join(', ')}`
      ]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Check-out completado con éxito',
      rental_id: rental_id,
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

// GET /api/checkout/:rentalId/summary - Obtenir le résumé d'un check-out
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
