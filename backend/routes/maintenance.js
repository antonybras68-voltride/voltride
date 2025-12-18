const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// =====================================================
// MAINTENANCE API ROUTES
// =====================================================

// GET /api/maintenance - Liste des enregistrements de maintenance
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, vehicle_id, type, priority, agency_id } = req.query;
    
    let query = `
      SELECT 
        m.*,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        v.current_km, v.license_plate,
        a.name as agency_name, a.code as agency_code,
        u1.full_name as reported_by_name,
        u2.full_name as assigned_to_name,
        u3.full_name as completed_by_name,
        r.contract_number
      FROM maintenance_records m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      LEFT JOIN agencies a ON v.agency_id = a.id
      LEFT JOIN users u1 ON m.reported_by = u1.id
      LEFT JOIN users u2 ON m.assigned_to = u2.id
      LEFT JOIN users u3 ON m.completed_by = u3.id
      LEFT JOIN rentals r ON m.rental_id = r.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (vehicle_id) {
      query += ` AND m.vehicle_id = $${paramIndex}`;
      params.push(vehicle_id);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND m.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (priority) {
      query += ` AND m.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }
    
    if (agency_id) {
      query += ` AND v.agency_id = $${paramIndex}`;
      params.push(agency_id);
      paramIndex++;
    }
    
    query += ' ORDER BY m.priority DESC, m.reported_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/maintenance/stats - Statistiques de maintenance
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (agency_id) {
      whereClause = 'WHERE v.agency_id = $1';
      params.push(agency_id);
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE m.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE m.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE m.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE m.priority = 'high' AND m.status != 'completed') as high_priority,
        COUNT(*) FILTER (WHERE m.type = 'scheduled_km') as scheduled_km,
        COUNT(*) FILTER (WHERE m.type = 'scheduled_days') as scheduled_days,
        COUNT(*) FILTER (WHERE m.type = 'repair') as repairs,
        COUNT(*) as total
      FROM maintenance_records m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      ${whereClause}
    `, params);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/maintenance/vehicles-needing - Véhicules nécessitant maintenance
router.get('/vehicles-needing', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let whereClause = 'WHERE v.status = $1';
    const params = ['maintenance'];
    let paramIndex = 2;
    
    if (agency_id) {
      whereClause += ` AND v.agency_id = $${paramIndex}`;
      params.push(agency_id);
    }
    
    const result = await pool.query(`
      SELECT 
        v.*,
        a.name as agency_name,
        COUNT(m.id) as pending_issues,
        MAX(m.priority) as max_priority
      FROM vehicles v
      LEFT JOIN agencies a ON v.agency_id = a.id
      LEFT JOIN maintenance_records m ON v.id = m.vehicle_id AND m.status != 'completed'
      ${whereClause}
      GROUP BY v.id, a.name
      ORDER BY pending_issues DESC
    `, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/maintenance/:id - Détail d'un enregistrement
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        v.current_km, v.license_plate, v.total_rental_days,
        a.name as agency_name,
        u1.full_name as reported_by_name,
        u2.full_name as assigned_to_name,
        u3.full_name as completed_by_name,
        r.contract_number, r.start_date as rental_start, r.end_date as rental_end
      FROM maintenance_records m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      LEFT JOIN agencies a ON v.agency_id = a.id
      LEFT JOIN users u1 ON m.reported_by = u1.id
      LEFT JOIN users u2 ON m.assigned_to = u2.id
      LEFT JOIN users u3 ON m.completed_by = u3.id
      LEFT JOIN rentals r ON m.rental_id = r.id
      WHERE m.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/maintenance/vehicle/:vehicleId/history - Historique d'un véhicule
router.get('/vehicle/:vehicleId/history', authMiddleware, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        u1.full_name as reported_by_name,
        u2.full_name as completed_by_name,
        r.contract_number
      FROM maintenance_records m
      LEFT JOIN users u1 ON m.reported_by = u1.id
      LEFT JOIN users u2 ON m.completed_by = u2.id
      LEFT JOIN rentals r ON m.rental_id = r.id
      WHERE m.vehicle_id = $1
      ORDER BY m.reported_at DESC
    `, [vehicleId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/maintenance - Créer un enregistrement de maintenance
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      vehicle_id, 
      type, 
      priority, 
      description, 
      photos_before 
    } = req.body;
    
    const user = req.user;
    
    const result = await pool.query(`
      INSERT INTO maintenance_records 
        (vehicle_id, type, priority, description, reported_by, photos_before)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      vehicle_id,
      type || 'repair',
      priority || 'normal',
      description,
      user.id,
      photos_before ? JSON.stringify(photos_before) : null
    ]);
    
    // Mettre le véhicule en maintenance
    await pool.query(`
      UPDATE vehicles SET status = 'maintenance' WHERE id = $1
    `, [vehicle_id]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/maintenance/:id - Mettre à jour un enregistrement
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      assigned_to, 
      notes, 
      photos_after,
      parts_used,
      cost 
    } = req.body;
    
    const user = req.user;
    let updateFields = [];
    let params = [];
    let paramIndex = 1;
    
    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
      
      if (status === 'in_progress') {
        updateFields.push(`started_at = NOW()`);
      }
      
      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
        updateFields.push(`completed_by = $${paramIndex}`);
        params.push(user.id);
        paramIndex++;
      }
    }
    
    if (assigned_to !== undefined) {
      updateFields.push(`assigned_to = $${paramIndex}`);
      params.push(assigned_to);
      paramIndex++;
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }
    
    if (photos_after) {
      updateFields.push(`photos_after = $${paramIndex}`);
      params.push(JSON.stringify(photos_after));
      paramIndex++;
    }
    
    if (parts_used !== undefined) {
      updateFields.push(`parts_used = $${paramIndex}`);
      params.push(parts_used);
      paramIndex++;
    }
    
    if (cost !== undefined) {
      updateFields.push(`cost = $${paramIndex}`);
      params.push(cost);
      paramIndex++;
    }
    
    params.push(id);
    
    const result = await pool.query(`
      UPDATE maintenance_records 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    // Si complété, vérifier si le véhicule peut être remis disponible
    if (status === 'completed') {
      const vehicleId = result.rows[0].vehicle_id;
      
      // Vérifier s'il reste des maintenances en attente
      const pendingCheck = await pool.query(`
        SELECT COUNT(*) as count FROM maintenance_records 
        WHERE vehicle_id = $1 AND status != 'completed'
      `, [vehicleId]);
      
      if (parseInt(pendingCheck.rows[0].count) === 0) {
        // Mettre à jour le véhicule comme disponible et reset compteurs
        const maintenanceRecord = result.rows[0];
        
        if (maintenanceRecord.type === 'scheduled_km') {
          await pool.query(`
            UPDATE vehicles 
            SET status = 'available', last_maintenance_km = current_km, last_maintenance_date = NOW()
            WHERE id = $1
          `, [vehicleId]);
        } else if (maintenanceRecord.type === 'scheduled_days') {
          await pool.query(`
            UPDATE vehicles 
            SET status = 'available', last_maintenance_date = NOW()
            WHERE id = $1
          `, [vehicleId]);
        } else {
          await pool.query(`
            UPDATE vehicles SET status = 'available' WHERE id = $1
          `, [vehicleId]);
        }
      }
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/maintenance/:id - Supprimer un enregistrement
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer le vehicle_id avant suppression
    const record = await pool.query('SELECT vehicle_id FROM maintenance_records WHERE id = $1', [id]);
    
    await pool.query('DELETE FROM maintenance_records WHERE id = $1', [id]);
    
    // Vérifier si le véhicule peut être remis disponible
    if (record.rows.length > 0) {
      const vehicleId = record.rows[0].vehicle_id;
      const pendingCheck = await pool.query(`
        SELECT COUNT(*) as count FROM maintenance_records 
        WHERE vehicle_id = $1 AND status != 'completed'
      `, [vehicleId]);
      
      if (parseInt(pendingCheck.rows[0].count) === 0) {
        await pool.query(`
          UPDATE vehicles SET status = 'available' WHERE id = $1 AND status = 'maintenance'
        `, [vehicleId]);
      }
    }
    
    res.json({ message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/maintenance/:id/complete - Marquer comme terminé rapidement
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, cost } = req.body;
    const user = req.user;
    
    const result = await pool.query(`
      UPDATE maintenance_records 
      SET status = 'completed', completed_at = NOW(), completed_by = $1, notes = COALESCE($2, notes), cost = COALESCE($3, cost)
      WHERE id = $4
      RETURNING *
    `, [user.id, notes, cost, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    // Vérifier si le véhicule peut être remis disponible
    const vehicleId = result.rows[0].vehicle_id;
    const pendingCheck = await pool.query(`
      SELECT COUNT(*) as count FROM maintenance_records 
      WHERE vehicle_id = $1 AND status != 'completed'
    `, [vehicleId]);
    
    if (parseInt(pendingCheck.rows[0].count) === 0) {
      await pool.query(`
        UPDATE vehicles 
        SET status = 'available', last_maintenance_date = NOW()
        WHERE id = $1
      `, [vehicleId]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
