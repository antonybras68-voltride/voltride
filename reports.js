const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// Générer un numéro de rapport Z
async function generateReportNumber(agencyId) {
  const date = new Date();
  const year = date.getFullYear();
  
  // Compter les rapports de l'année pour cette agence
  const result = await pool.query(`
    SELECT COUNT(*) FROM z_reports 
    WHERE agency_id = $1 AND EXTRACT(YEAR FROM date) = $2
  `, [agencyId, year]);
  
  const count = parseInt(result.rows[0].count) + 1;
  
  return `Z-${year}-${count.toString().padStart(4, '0')}`;
}

// GET /api/reports/z - Listar rapports Z
router.get('/z', authMiddleware, async (req, res) => {
  try {
    const { agency_id, date_from, date_to } = req.query;
    
    let query = `
      SELECT z.*, a.code as agency_code, a.name as agency_name, u.full_name as user_name
      FROM z_reports z
      LEFT JOIN agencies a ON z.agency_id = a.id
      LEFT JOIN users u ON z.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (agency_id) {
      query += ` AND z.agency_id = $${paramIndex}`;
      params.push(agency_id);
      paramIndex++;
    }
    
    if (date_from) {
      query += ` AND z.date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      query += ` AND z.date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    
    query += ' ORDER BY z.date DESC, z.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/z/check - Vérifier si rapport Z existe pour aujourd'hui
router.get('/z/check', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    const result = await pool.query(`
      SELECT * FROM z_reports 
      WHERE agency_id = $1 AND date = CURRENT_DATE
    `, [agency_id || req.user.agency_id]);
    
    res.json({
      exists: result.rows.length > 0,
      report: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/reports/z - Créer rapport Z (clôture de caisse)
router.post('/z', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { agency_id, notes } = req.body;
    const targetAgencyId = agency_id || req.user.agency_id;
    
    // Vérifier si un rapport existe déjà pour aujourd'hui
    const existingReport = await client.query(`
      SELECT id FROM z_reports 
      WHERE agency_id = $1 AND date = CURRENT_DATE
    `, [targetAgencyId]);
    
    if (existingReport.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ya existe un informe Z para hoy en esta agencia' });
    }
    
    // Calculer les totaux du jour
    const paymentsResult = await client.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash' AND amount > 0), 0) as cash_in,
        COALESCE(SUM(ABS(amount)) FILTER (WHERE payment_method = 'cash' AND amount < 0), 0) as cash_out,
        COALESCE(SUM(amount) FILTER (WHERE payment_method = 'card' AND amount > 0), 0) as card_total,
        COALESCE(SUM(amount) FILTER (WHERE payment_method = 'transfer' AND amount > 0), 0) as transfer_total
      FROM payments
      WHERE agency_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [targetAgencyId]);
    
    const payments = paymentsResult.rows[0];
    const totalCash = parseFloat(payments.cash_in) - parseFloat(payments.cash_out);
    const totalCard = parseFloat(payments.card_total);
    const totalTransfer = parseFloat(payments.transfer_total);
    const totalAmount = totalCash + totalCard + totalTransfer;
    
    // Compter les locations et retours du jour
    const rentalsCount = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as new_rentals,
        COUNT(*) FILTER (WHERE DATE(end_date) = CURRENT_DATE AND status = 'completed') as returns
      FROM rentals
      WHERE agency_id = $1
    `, [targetAgencyId]);
    
    const counts = rentalsCount.rows[0];
    
    // Générer numéro de rapport
    const reportNumber = await generateReportNumber(targetAgencyId);
    
    // Créer le rapport Z
    const result = await client.query(`
      INSERT INTO z_reports (
        report_number, agency_id, user_id, date,
        total_cash, total_card, total_transfer, total_amount,
        rentals_count, returns_count, notes
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      reportNumber, targetAgencyId, req.user.id,
      totalCash, totalCard, totalTransfer, totalAmount,
      parseInt(counts.new_rentals), parseInt(counts.returns), notes
    ]);
    
    await client.query('COMMIT');
    
    // Récupérer les détails complets
    const fullReport = await pool.query(`
      SELECT z.*, a.code as agency_code, a.name as agency_name, u.full_name as user_name
      FROM z_reports z
      LEFT JOIN agencies a ON z.agency_id = a.id
      LEFT JOIN users u ON z.user_id = u.id
      WHERE z.id = $1
    `, [result.rows[0].id]);
    
    res.status(201).json(fullReport.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// GET /api/reports/z/:id - Obtenir un rapport Z
router.get('/z/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT z.*, a.code as agency_code, a.name as agency_name, u.full_name as user_name
      FROM z_reports z
      LEFT JOIN agencies a ON z.agency_id = a.id
      LEFT JOIN users u ON z.user_id = u.id
      WHERE z.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/dashboard - Statistiques pour le dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (agency_id) {
      whereClause = 'WHERE agency_id = $1';
      params.push(agency_id);
    }
    
    // Statistiques globales
    const vehiclesStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'rented') as rented,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
      FROM vehicles
      ${whereClause}
    `, params);
    
    const rentalsStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_new,
        COUNT(*) FILTER (WHERE DATE(end_date) = CURRENT_DATE AND status = 'completed') as today_returns
      FROM rentals
      ${whereClause}
    `, params);
    
    const revenueStats = await pool.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND amount > 0), 0) as today_revenue,
        COALESCE(SUM(amount) FILTER (WHERE 
          created_at >= DATE_TRUNC('month', CURRENT_DATE) AND amount > 0
        ), 0) as month_revenue
      FROM payments
      ${whereClause}
    `, params);
    
    res.json({
      vehicles: vehiclesStats.rows[0],
      rentals: rentalsStats.rows[0],
      revenue: revenueStats.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
