const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// GET /api/agencies - Listar todas las agencias
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM agencies ORDER BY code');
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/agencies/:id - Obtener una agencia
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM agencies WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/agencies - Crear agencia (solo admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { code, name, address, phone, email } = req.body;
    
    // Verificar si el código ya existe
    const existingAgency = await pool.query('SELECT id FROM agencies WHERE code = $1', [code]);
    if (existingAgency.rows.length > 0) {
      return res.status(400).json({ error: 'El código de agencia ya existe' });
    }
    
    const result = await pool.query(`
      INSERT INTO agencies (code, name, address, phone, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [code, name, address, phone, email]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/agencies/:id - Actualizar agencia (solo admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    const { code, name, address, phone, email } = req.body;
    
    const result = await pool.query(`
      UPDATE agencies 
      SET code = $1, name = $2, address = $3, phone = $4, email = $5
      WHERE id = $6
      RETURNING *
    `, [code, name, address, phone, email, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/agencies/:id - Eliminar agencia (solo admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    
    // Verificar si hay vehículos o usuarios asociados
    const vehiclesCheck = await pool.query('SELECT id FROM vehicles WHERE agency_id = $1 LIMIT 1', [id]);
    const usersCheck = await pool.query('SELECT id FROM users WHERE agency_id = $1 LIMIT 1', [id]);
    
    if (vehiclesCheck.rows.length > 0 || usersCheck.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: la agencia tiene vehículos o usuarios asociados' });
    }
    
    await pool.query('DELETE FROM agencies WHERE id = $1', [id]);
    
    res.json({ message: 'Agencia eliminada' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/agencies/:id/stats - Estadísticas de una agencia
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehiclesStats = await pool.query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'rented') as rented
      FROM vehicles WHERE agency_id = $1
    `, [id]);
    
    const rentalsStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_rentals,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_rentals,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND DATE(end_date) = CURRENT_DATE), 0) as today_revenue
      FROM rentals WHERE agency_id = $1
    `, [id]);
    
    res.json({
      ...vehiclesStats.rows[0],
      ...rentalsStats.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
