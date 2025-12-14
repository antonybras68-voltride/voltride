const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// GET /api/payments - Listar pagos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { agency_id, date_from, date_to, payment_method } = req.query;
    
    let query = `
      SELECT p.*, 
             r.contract_number,
             c.first_name, c.last_name,
             u.full_name as user_name
      FROM payments p
      LEFT JOIN rentals r ON p.rental_id = r.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (agency_id) {
      query += ` AND p.agency_id = $${paramIndex}`;
      params.push(agency_id);
      paramIndex++;
    }
    
    if (date_from) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    
    if (payment_method) {
      query += ` AND p.payment_method = $${paramIndex}`;
      params.push(payment_method);
      paramIndex++;
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/payments/today - Pagos del día (para la caisse)
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let query = `
      SELECT p.*, 
             r.contract_number,
             c.first_name, c.last_name,
             u.full_name as user_name
      FROM payments p
      LEFT JOIN rentals r ON p.rental_id = r.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE DATE(p.created_at) = CURRENT_DATE
    `;
    const params = [];
    
    if (agency_id) {
      query += ' AND p.agency_id = $1';
      params.push(agency_id);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/payments/summary - Résumé des paiements
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { agency_id, date } = req.query;
    const targetDate = date || 'CURRENT_DATE';
    
    let whereClause = `WHERE DATE(p.created_at) = ${date ? '$1' : 'CURRENT_DATE'}`;
    const params = [];
    let paramIndex = 1;
    
    if (date) {
      params.push(date);
      paramIndex++;
    }
    
    if (agency_id) {
      whereClause += ` AND p.agency_id = $${paramIndex}`;
      params.push(agency_id);
    }
    
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'cash' AND p.amount > 0), 0) as cash_in,
        COALESCE(SUM(ABS(p.amount)) FILTER (WHERE p.payment_method = 'cash' AND p.amount < 0), 0) as cash_out,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'card' AND p.amount > 0), 0) as card_in,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'transfer' AND p.amount > 0), 0) as transfer_in,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'rental'), 0) as rental_total,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'deposit' AND p.amount > 0), 0) as deposits_in,
        COALESCE(SUM(ABS(p.amount)) FILTER (WHERE p.payment_type = 'deposit_return'), 0) as deposits_out,
        COUNT(*) FILTER (WHERE p.payment_type = 'rental') as rental_count
      FROM payments p
      ${whereClause}
    `, params);
    
    const summary = result.rows[0];
    
    // Calculer les totaux
    summary.total_in = parseFloat(summary.cash_in) + parseFloat(summary.card_in) + parseFloat(summary.transfer_in);
    summary.total_out = parseFloat(summary.cash_out);
    summary.net_cash = parseFloat(summary.cash_in) - parseFloat(summary.cash_out);
    
    res.json(summary);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/payments - Créer un paiement manuel
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rental_id, agency_id, amount, payment_type, payment_method, description } = req.body;
    
    const result = await pool.query(`
      INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [rental_id, agency_id || req.user.agency_id, req.user.id, amount, payment_type, payment_method, description]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
