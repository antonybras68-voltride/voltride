const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// GET /api/vehicles - Listar todos los vehículos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { agency_id, status, type } = req.query;
    
    let query = `
      SELECT v.*, a.code as agency_code, a.name as agency_name
      FROM vehicles v
      LEFT JOIN agencies a ON v.agency_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (agency_id) {
      query += ` AND v.agency_id = $${paramIndex}`;
      params.push(agency_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND v.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND v.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ' ORDER BY v.code';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/vehicles/stats/summary - Estadísticas de vehículos (DEBE ESTAR ANTES DE /:id)
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (agency_id) {
      whereClause = 'WHERE agency_id = $1';
      params.push(agency_id);
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'rented') as rented,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
        COUNT(*) FILTER (WHERE type = 'bike') as bikes,
        COUNT(*) FILTER (WHERE type = 'ebike') as ebikes,
        COUNT(*) FILTER (WHERE type = 'scooter') as scooters
      FROM vehicles
      ${whereClause}
    `, params);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/vehicles/:id - Obtener un vehículo
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT v.*, a.code as agency_code, a.name as agency_name
      FROM vehicles v
      LEFT JOIN agencies a ON v.agency_id = a.id
      WHERE v.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/vehicles - Crear vehículo
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { code, type, brand, model, color, daily_rate, deposit, status, agency_id, notes } = req.body;
    
    // Verificar si el código ya existe
    const existingVehicle = await pool.query('SELECT id FROM vehicles WHERE code = $1', [code]);
    if (existingVehicle.rows.length > 0) {
      return res.status(400).json({ error: 'El código de vehículo ya existe' });
    }
    
    const result = await pool.query(`
      INSERT INTO vehicles (code, type, brand, model, color, daily_rate, deposit, status, agency_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [code, type, brand, model, color, daily_rate || 0, deposit || 0, status || 'available', agency_id, notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/vehicles/:id/duplicate - Duplicar vehículo
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_code, agency_id } = req.body;
    
    // Obtener el vehículo original
    const original = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    const v = original.rows[0];
    const finalCode = new_code || `${v.code}-COPY`;
    const finalAgencyId = agency_id || v.agency_id;
    
    // Verificar que el nuevo código no exista
    const existingVehicle = await pool.query('SELECT id FROM vehicles WHERE code = $1', [finalCode]);
    if (existingVehicle.rows.length > 0) {
      return res.status(400).json({ error: 'El código de vehículo ya existe' });
    }
    
    // Crear el duplicado
    const result = await pool.query(`
      INSERT INTO vehicles (code, type, brand, model, color, daily_rate, deposit, status, agency_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', $8, $9)
      RETURNING *
    `, [finalCode, v.type, v.brand, v.model, v.color, v.daily_rate, v.deposit, finalAgencyId, v.notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/vehicles/:id - Actualizar vehículo
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, brand, model, color, daily_rate, deposit, status, agency_id, notes } = req.body;
    
    // Verificar si el código ya existe en otro vehículo
    const existingVehicle = await pool.query('SELECT id FROM vehicles WHERE code = $1 AND id != $2', [code, id]);
    if (existingVehicle.rows.length > 0) {
      return res.status(400).json({ error: 'El código de vehículo ya existe' });
    }
    
    const result = await pool.query(`
      UPDATE vehicles 
      SET code = $1, type = $2, brand = $3, model = $4, color = $5, 
          daily_rate = $6, deposit = $7, status = $8, agency_id = $9, notes = $10
      WHERE id = $11
      RETURNING *
    `, [code, type, brand, model, color, daily_rate || 0, deposit || 0, status, agency_id, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/vehicles/:id - Eliminar vehículo
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si hay alquileres asociados
    const rentalsCheck = await pool.query('SELECT id FROM rentals WHERE vehicle_id = $1 LIMIT 1', [id]);
    if (rentalsCheck.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: el vehículo tiene alquileres asociados' });
    }
    
    await pool.query('DELETE FROM vehicles WHERE id = $1', [id]);
    
    res.json({ message: 'Vehículo eliminado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
