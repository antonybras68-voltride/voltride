const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');

// Security: JWT_SECRET must be set via environment variable - no hardcoded fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
}

// Middleware de vérification du token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Buscar usuario
    const result = await pool.query(`
      SELECT u.*, a.code as agency_code, a.name as agency_name
      FROM users u
      LEFT JOIN agencies a ON u.agency_id = a.id
      WHERE u.username = $1 AND u.active = true
    `, [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    const user = result.rows[0];
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    // Generar token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        agency_id: user.agency_id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        agency_id: user.agency_id,
        agency_code: user.agency_code,
        agency_name: user.agency_name
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me - Obtener usuario actual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.role, u.agency_id, 
             a.code as agency_code, a.name as agency_name
      FROM users u
      LEFT JOIN agencies a ON u.agency_id = a.id
      WHERE u.id = $1
    `, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/users - Listar usuarios (solo admin)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.role, u.agency_id, u.active,
             a.code as agency_code, a.name as agency_name
      FROM users u
      LEFT JOIN agencies a ON u.agency_id = a.id
      ORDER BY u.full_name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/users - Crear usuario (solo admin)
router.post('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { username, password, full_name, role, agency_id } = req.body;
    
    // Verificar si el usuario ya existe
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(`
      INSERT INTO users (username, password, full_name, role, agency_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, full_name, role, agency_id
    `, [username, hashedPassword, full_name, role, agency_id]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/auth/users/:id - Actualizar usuario (solo admin)
router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    const { username, password, full_name, role, agency_id, active } = req.body;
    
    let query, params;
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE users 
        SET username = $1, password = $2, full_name = $3, role = $4, agency_id = $5, active = $6
        WHERE id = $7
        RETURNING id, username, full_name, role, agency_id, active
      `;
      params = [username, hashedPassword, full_name, role, agency_id, active, id];
    } else {
      query = `
        UPDATE users 
        SET username = $1, full_name = $2, role = $3, agency_id = $4, active = $5
        WHERE id = $6
        RETURNING id, username, full_name, role, agency_id, active
      `;
      params = [username, full_name, role, agency_id, active, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/auth/users/:id - Eliminar usuario (solo admin)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { id } = req.params;
    
    // No permitir eliminar el propio usuario
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'No puede eliminar su propio usuario' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
