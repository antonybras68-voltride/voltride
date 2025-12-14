const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// GET /api/customers - Listar todos los clientes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = 'SELECT * FROM customers';
    const params = [];
    
    if (search) {
      query += ` WHERE 
        LOWER(first_name) LIKE LOWER($1) OR 
        LOWER(last_name) LIKE LOWER($1) OR 
        LOWER(email) LIKE LOWER($1) OR
        phone LIKE $1 OR
        id_number LIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY last_name, first_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/customers/:id - Obtener un cliente
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/customers - Crear cliente
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, id_type, id_number, address, city, country, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO customers (first_name, last_name, email, phone, id_type, id_number, address, city, country, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [first_name, last_name, email, phone, id_type, id_number, address, city, country, notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/customers/:id - Actualizar cliente
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, id_type, id_number, address, city, country, notes } = req.body;
    
    const result = await pool.query(`
      UPDATE customers 
      SET first_name = $1, last_name = $2, email = $3, phone = $4, id_type = $5,
          id_number = $6, address = $7, city = $8, country = $9, notes = $10
      WHERE id = $11
      RETURNING *
    `, [first_name, last_name, email, phone, id_type, id_number, address, city, country, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/customers/:id - Eliminar cliente
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si hay alquileres asociados
    const rentalsCheck = await pool.query('SELECT id FROM rentals WHERE customer_id = $1 LIMIT 1', [id]);
    if (rentalsCheck.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene alquileres asociados' });
    }
    
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    
    res.json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/customers/:id/rentals - Historial de alquileres del cliente
router.get('/:id/rentals', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT r.*, v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model
      FROM rentals r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.customer_id = $1
      ORDER BY r.start_date DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
