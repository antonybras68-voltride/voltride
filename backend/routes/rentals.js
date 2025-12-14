const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authMiddleware } = require('./auth');

// Générer un numéro de contrat unique
async function generateContractNumber(agencyCode) {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Compter les contrats du jour
  const result = await pool.query(`
    SELECT COUNT(*) FROM rentals 
    WHERE DATE(created_at) = CURRENT_DATE
  `);
  const count = parseInt(result.rows[0].count) + 1;
  
  return `${agencyCode}-${year}${month}${day}-${count.toString().padStart(3, '0')}`;
}

// Calculer le prix (périodes de 24h avec 1h de tolérance)
function calculatePrice(startDate, endDate, dailyRate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Calculer les jours (1h de tolérance)
  let days = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  // Si plus d'1h de dépassement, compter un jour supplémentaire
  if (remainingHours > 1) {
    days += 1;
  }
  
  // Minimum 1 jour
  days = Math.max(1, days);
  
  return {
    days,
    total: days * dailyRate
  };
}

// GET /api/rentals - Listar alquileres
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { agency_id, status, customer_id, vehicle_id } = req.query;
    
    let query = `
      SELECT r.*, 
             c.first_name, c.last_name, c.phone as customer_phone, c.email as customer_email,
             v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
             a.code as agency_code, a.name as agency_name,
             u.full_name as user_name
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (agency_id) {
      query += ` AND r.agency_id = $${paramIndex}`;
      params.push(agency_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (customer_id) {
      query += ` AND r.customer_id = $${paramIndex}`;
      params.push(customer_id);
      paramIndex++;
    }
    
    if (vehicle_id) {
      query += ` AND r.vehicle_id = $${paramIndex}`;
      params.push(vehicle_id);
      paramIndex++;
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/rentals/active - Alquileres activos
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const { agency_id } = req.query;
    
    let query = `
      SELECT r.*, 
             c.first_name, c.last_name, c.phone as customer_phone,
             v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.status = 'active'
    `;
    const params = [];
    
    if (agency_id) {
      query += ' AND r.agency_id = $1';
      params.push(agency_id);
    }
    
    query += ' ORDER BY r.planned_end_date ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/rentals/:id - Obtener un alquiler
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT r.*, 
             c.first_name, c.last_name, c.phone as customer_phone, c.email as customer_email,
             c.id_type, c.id_number, c.address as customer_address, c.city, c.country,
             v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model, v.color,
             a.code as agency_code, a.name as agency_name, a.address as agency_address, a.phone as agency_phone,
             u.full_name as user_name
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alquiler no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/rentals - Crear alquiler
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      customer_id, vehicle_id, agency_id, 
      start_date, planned_end_date, 
      daily_rate, deposit,
      deposit_paid, amount_paid, payment_method,
      notes, signature_customer
    } = req.body;
    
    // Verificar que el vehículo está disponible
    const vehicleCheck = await client.query(
      'SELECT status, code FROM vehicles WHERE id = $1',
      [vehicle_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    if (vehicleCheck.rows[0].status !== 'available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El vehículo no está disponible' });
    }
    
    // Obtener código de agencia
    const agencyResult = await client.query('SELECT code FROM agencies WHERE id = $1', [agency_id]);
    const agencyCode = agencyResult.rows[0]?.code || 'AG-01';
    
    // Generar número de contrato
    const contractNumber = await generateContractNumber(agencyCode);
    
    // Calcular el precio estimado
    const priceCalc = calculatePrice(start_date, planned_end_date, daily_rate);
    
    // Crear el alquiler
    const result = await client.query(`
      INSERT INTO rentals (
        contract_number, customer_id, vehicle_id, agency_id, user_id,
        start_date, planned_end_date, daily_rate, deposit, total_amount,
        deposit_paid, amount_paid, payment_method, status, notes, signature_customer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', $14, $15)
      RETURNING *
    `, [
      contractNumber, customer_id, vehicle_id, agency_id, req.user.id,
      start_date, planned_end_date, daily_rate, deposit || 0, priceCalc.total,
      deposit_paid || 0, amount_paid || 0, payment_method, notes, signature_customer
    ]);
    
    // Actualizar estado del vehículo
    await client.query(
      'UPDATE vehicles SET status = $1 WHERE id = $2',
      ['rented', vehicle_id]
    );
    
    // Registrar los pagos si hay
    if (deposit_paid > 0) {
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, 'deposit', $5, 'Depósito de garantía')
      `, [result.rows[0].id, agency_id, req.user.id, deposit_paid, payment_method]);
    }
    
    if (amount_paid > 0) {
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, 'rental', $5, 'Pago de alquiler')
      `, [result.rows[0].id, agency_id, req.user.id, amount_paid, payment_method]);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// PUT /api/rentals/:id/return - Devolver vehículo
router.put('/:id/return', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { end_date, amount_paid, payment_method, return_deposit, notes } = req.body;
    
    // Obtener el alquiler
    const rentalResult = await client.query(`
      SELECT r.*, v.id as vehicle_id 
      FROM rentals r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
    `, [id]);
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alquiler no encontrado' });
    }
    
    const rental = rentalResult.rows[0];
    
    if (rental.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El alquiler no está activo' });
    }
    
    // Calcular el precio final
    const priceCalc = calculatePrice(rental.start_date, end_date, rental.daily_rate);
    
    // Actualizar el alquiler
    const updateResult = await client.query(`
      UPDATE rentals 
      SET end_date = $1, total_amount = $2, amount_paid = amount_paid + $3, 
          status = 'completed', notes = COALESCE(notes, '') || $4
      WHERE id = $5
      RETURNING *
    `, [end_date, priceCalc.total, amount_paid || 0, notes ? '\n' + notes : '', id]);
    
    // Actualizar estado del vehículo
    await client.query(
      'UPDATE vehicles SET status = $1 WHERE id = $2',
      ['available', rental.vehicle_id]
    );
    
    // Registrar pago final si hay
    if (amount_paid > 0) {
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, 'rental', $5, 'Pago final de alquiler')
      `, [id, rental.agency_id, req.user.id, amount_paid, payment_method]);
    }
    
    // Registrar devolución de depósito
    if (return_deposit && rental.deposit_paid > 0) {
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, 'deposit_return', $5, 'Devolución de depósito')
      `, [id, rental.agency_id, req.user.id, -rental.deposit_paid, payment_method || 'cash']);
    }
    
    await client.query('COMMIT');
    
    res.json({
      ...updateResult.rows[0],
      calculated_days: priceCalc.days,
      calculated_total: priceCalc.total
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// PUT /api/rentals/:id - Actualizar alquiler
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { planned_end_date, daily_rate, notes } = req.body;
    
    const result = await pool.query(`
      UPDATE rentals 
      SET planned_end_date = COALESCE($1, planned_end_date),
          daily_rate = COALESCE($2, daily_rate),
          notes = COALESCE($3, notes)
      WHERE id = $4
      RETURNING *
    `, [planned_end_date, daily_rate, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alquiler no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/rentals/:id - Cancelar/eliminar alquiler
router.delete('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Obtener el alquiler
    const rentalResult = await client.query('SELECT * FROM rentals WHERE id = $1', [id]);
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alquiler no encontrado' });
    }
    
    const rental = rentalResult.rows[0];
    
    // Si está activo, liberar el vehículo
    if (rental.status === 'active') {
      await client.query(
        'UPDATE vehicles SET status = $1 WHERE id = $2',
        ['available', rental.vehicle_id]
      );
    }
    
    // Eliminar pagos asociados
    await client.query('DELETE FROM payments WHERE rental_id = $1', [id]);
    
    // Eliminar el alquiler
    await client.query('DELETE FROM rentals WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({ message: 'Alquiler eliminado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// POST /api/rentals/:id/payment - Añadir pago
router.post('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_type, payment_method, description } = req.body;
    
    // Obtener el alquiler
    const rentalResult = await pool.query('SELECT * FROM rentals WHERE id = $1', [id]);
    
    if (rentalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alquiler no encontrado' });
    }
    
    const rental = rentalResult.rows[0];
    
    // Registrar el pago
    const paymentResult = await pool.query(`
      INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, rental.agency_id, req.user.id, amount, payment_type, payment_method, description]);
    
    // Actualizar el alquiler
    if (payment_type === 'rental') {
      await pool.query(
        'UPDATE rentals SET amount_paid = amount_paid + $1 WHERE id = $2',
        [amount, id]
      );
    } else if (payment_type === 'deposit') {
      await pool.query(
        'UPDATE rentals SET deposit_paid = deposit_paid + $1 WHERE id = $2',
        [amount, id]
      );
    }
    
    res.status(201).json(paymentResult.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/rentals/stats/summary - Estadísticas
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
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
        COALESCE(SUM(amount_paid), 0) as total_paid
      FROM rentals
      ${whereClause}
    `, params);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
