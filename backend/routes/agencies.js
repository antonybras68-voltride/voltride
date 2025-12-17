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
  const { code, name, address, phone, email } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden crear agencias' });
  }
  
  try {
    const existing = await pool.query('SELECT id FROM agencies WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una agencia con este código' });
    }
    
    const result = await pool.query(`
      INSERT INTO agencies (code, name, address, phone, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [code, name, address || null, phone || null, email || null]);
    
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
  const { code, name, address, phone, email } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden modificar agencias' });
  }
  
  try {
    // Vérifier que l'agence existe
    const existing = await pool.query('SELECT * FROM agencies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    
    // Mettre à jour
    const result = await pool.query(`
      UPDATE agencies 
      SET code = $1,
          name = $2,
          address = $3,
          phone = $4,
          email = $5
      WHERE id = $6
      RETURNING *
    `, [
      code || existing.rows[0].code,
      name || existing.rows[0].name,
      address || null,
      phone || null,
      email || null,
      id
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating agency:', error);
    res.status(500).json({ error: 'Error al actualizar: ' + error.message });
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
    await pool.query('DELETE FROM agencies WHERE id = $1', [id]);
    res.json({ message: 'Agencia eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting agency:', error);
    res.status(500).json({ error: 'Error al eliminar: ' + error.message });
  }
});

module.exports = router;
