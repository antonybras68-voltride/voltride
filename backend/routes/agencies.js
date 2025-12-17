const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');

// GET /api/agencies - Obtenir toutes les agences
router.get('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  try {
    const result = await pool.query('SELECT * FROM agencies ORDER BY code');
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting agencies:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/agencies/:id - Obtenir une agence par ID
router.get('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM agencies WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting agency:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/agencies - Créer une nouvelle agence
router.post('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const { code, name, address, phone, email, opening_hours } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden crear agencias' });
  }
  
  try {
    const existing = await pool.query('SELECT id FROM agencies WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una agencia con este código' });
    }
    
    const result = await pool.query(`
      INSERT INTO agencies (code, name, address, phone, email, opening_hours)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [code, name, address || null, phone || null, email || null, opening_hours || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating agency:', error);
    res.status(500).json({ error: 'Error al crear la agencia: ' + error.message });
  }
});

// PUT /api/agencies/:id - Mettre à jour une agence
router.put('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const { id } = req.params;
  const { code, name, address, phone, email, opening_hours } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden modificar agencias' });
  }
  
  try {
    const existing = await pool.query('SELECT id FROM agencies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    
    if (code) {
      const codeCheck = await pool.query('SELECT id FROM agencies WHERE code = $1 AND id != $2', [code, id]);
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe otra agencia con este código' });
      }
    }
    
    const result = await pool.query(`
      UPDATE agencies 
      SET code = COALESCE($1, code),
          name = COALESCE($2, name),
          address = $3,
          phone = $4,
          email = $5,
          opening_hours = $6
      WHERE id = $7
      RETURNING *
    `, [code, name, address || null, phone || null, email || null, opening_hours || null, id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating agency:', error);
    res.status(500).json({ error: 'Error al actualizar la agencia: ' + error.message });
  }
});

// DELETE /api/agencies/:id - Supprimer une agence
router.delete('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const { id } = req.params;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden eliminar agencias' });
  }
  
  try {
    const vehiclesCheck = await pool.query('SELECT COUNT(*) FROM vehicles WHERE agency_id = $1', [id]);
    if (parseInt(vehiclesCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: hay vehículos asociados' });
    }
    
    const rentalsCheck = await pool.query('SELECT COUNT(*) FROM rentals WHERE agency_id = $1', [id]);
    if (parseInt(rentalsCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: hay alquileres asociados' });
    }
    
    await pool.query('DELETE FROM agencies WHERE id = $1', [id]);
    res.json({ message: 'Agencia eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting agency:', error);
    res.status(500).json({ error: 'Error al eliminar la agencia: ' + error.message });
  }
});

module.exports = router;
