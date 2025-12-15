const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// POST /api/checkin - Créer un check-in complet (walk-in)
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { customer, vehicles, start_date, planned_end_date, agency_id, user_id, signature, id_photo } = req.body;
    
    // 1. Créer ou récupérer le client
    let customerId;
    
    // Vérifier si le client existe déjà (par email)
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE email = $1',
      [customer.email]
    );
    
    if (existingCustomer.rows.length > 0) {
      // Mettre à jour le client existant
      customerId = existingCustomer.rows[0].id;
      await client.query(`
        UPDATE customers 
        SET first_name = $1, last_name = $2, phone = $3, country = $4, 
            preferred_language = $5, id_type = $6, id_number = $7, address = $8
        WHERE id = $9
      `, [
        customer.first_name,
        customer.last_name,
        customer.phone,
        customer.country,
        customer.preferred_language,
        customer.id_type,
        customer.id_number,
        customer.address,
        customerId
      ]);
    } else {
      // Créer un nouveau client
      const newCustomer = await client.query(`
        INSERT INTO customers (first_name, last_name, email, phone, country, preferred_language, id_type, id_number, address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.phone,
        customer.country,
        customer.preferred_language,
        customer.id_type,
        customer.id_number,
        customer.address
      ]);
      customerId = newCustomer.rows[0].id;
    }
    
    // 2. Créer une location pour chaque véhicule
    const rentalIds = [];
    const contractNumbers = [];
    
    for (const vehicle of vehicles) {
      // Générer numéro de contrat unique
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const contractNumber = `AG-${String(agency_id).padStart(2, '0')}-${dateStr}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      // Calculer le nombre de jours
      const start = new Date(start_date);
      const end = new Date(planned_end_date);
      const diffHours = Math.abs(end - start) / (1000 * 60 * 60);
      let days = Math.floor(diffHours / 24);
      if (diffHours % 24 > 1) days++;
      days = Math.max(1, days);
      
      // Calculer le total (location + accessoires)
      const dailyRate = parseFloat(vehicle.daily_rate) || 0;
      let totalAmount = days * dailyRate;
      
      // Ajouter le prix des accessoires
      if (vehicle.accessories && vehicle.accessories.length > 0) {
        vehicle.accessories.forEach(acc => {
          if (acc.price > 0) {
            totalAmount += acc.price * days;
          }
        });
      }
      
      const deposit = parseFloat(vehicle.deposit) || 0;
      
      // Créer la location
      const rental = await client.query(`
        INSERT INTO rentals (
          contract_number, customer_id, vehicle_id, agency_id, user_id,
          start_date, planned_end_date, daily_rate, deposit, total_amount,
          status, signature_customer, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        contractNumber,
        customerId,
        vehicle.id,
        agency_id,
        user_id,
        start_date,
        planned_end_date,
        dailyRate,
        deposit,
        totalAmount,
        'active',
        signature,
        vehicle.accessories ? `Accessoires: ${vehicle.accessories.map(a => a.name).join(', ')}` : null
      ]);
      
      rentalIds.push(rental.rows[0].id);
      contractNumbers.push(contractNumber);
      
      // Mettre à jour le statut du véhicule
      await client.query(
        'UPDATE vehicles SET status = $1 WHERE id = $2',
        ['rented', vehicle.id]
      );
    }
    
    // 3. Sauvegarder la photo d'identité (optionnel - dans une table séparée ou en notes)
    if (id_photo) {
      // Pour l'instant on stocke juste une référence
      // Dans une vraie app, on sauvegarderait le fichier sur un service de stockage
      console.log('Photo ID reçue pour le client:', customerId);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Check-in completado con éxito',
      customer_id: customerId,
      rental_ids: rentalIds,
      contracts: contractNumbers
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en check-in:', error);
    res.status(500).json({ error: 'Error al procesar el check-in: ' + error.message });
  } finally {
    client.release();
  }
});

// GET /api/checkin/today - Obtenir les check-ins du jour
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.agency_id = $1 
        AND DATE(r.created_at) = CURRENT_DATE
      ORDER BY r.created_at DESC
    `, [agency_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
