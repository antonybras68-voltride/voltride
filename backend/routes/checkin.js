const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const { sendEmail, generateContractPDF, getContractEmailTemplate } = require('../services/emailService');

// POST /api/checkin - Créer un nouveau check-in walk-in
router.post('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('pool');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      customer,
      vehicles,
      start_date,
      planned_end_date,
      agency_id,
      user_id,
      signature,
      id_photo,
      payment
    } = req.body;
    
    // 1. Créer ou mettre à jour le client
    let customerId;
    
    if (customer.email) {
      const existingCustomer = await client.query(
        'SELECT id FROM customers WHERE email = $1',
        [customer.email]
      );
      
      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id;
        await client.query(`
          UPDATE customers SET
            first_name = $1, last_name = $2, phone = $3, country = $4,
            id_type = $5, id_number = $6, address = $7, preferred_language = $8
          WHERE id = $9
        `, [
          customer.first_name, customer.last_name, customer.phone, customer.country,
          customer.id_type, customer.id_number, customer.address, customer.preferred_language,
          customerId
        ]);
      }
    }
    
    if (!customerId) {
      const newCustomer = await client.query(`
        INSERT INTO customers (first_name, last_name, email, phone, country, id_type, id_number, address, preferred_language)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        customer.first_name, customer.last_name, customer.email, customer.phone,
        customer.country, customer.id_type, customer.id_number, customer.address,
        customer.preferred_language || 'es'
      ]);
      customerId = newCustomer.rows[0].id;
    }
    
    // 2. Créer les locations pour chaque véhicule
    const rentalIds = [];
    const contracts = [];
    
    for (const vehicle of vehicles) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const contractNumber = `VR-${dateStr}-${randomStr}`;
      
      const start = new Date(start_date);
      const end = new Date(planned_end_date);
      const diffHours = (end - start) / (1000 * 60 * 60);
      let days = Math.floor(diffHours / 24);
      if (diffHours % 24 > 1) days++;
      days = Math.max(1, days);
      
      const totalAmount = days * parseFloat(vehicle.daily_rate);
      const deposit = parseFloat(vehicle.deposit) || 0;
      
      const accessoriesNote = vehicle.accessories && vehicle.accessories.length > 0
        ? `Accesorios: ${vehicle.accessories.map(a => a.name).join(', ')}`
        : '';
      
      const rentalResult = await client.query(`
        INSERT INTO rentals (
          contract_number, customer_id, vehicle_id, agency_id, user_id,
          start_date, planned_end_date, daily_rate, deposit, total_amount,
          deposit_paid, amount_paid, payment_method, deposit_method,
          status, notes, signature_customer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        contractNumber, customerId, vehicle.id, agency_id, user_id,
        start_date, planned_end_date, vehicle.daily_rate, deposit, totalAmount,
        deposit, totalAmount, payment.rental_method, payment.deposit_method,
        'active', accessoriesNote, signature
      ]);
      
      rentalIds.push(rentalResult.rows[0].id);
      contracts.push(contractNumber);
      
      await client.query(
        'UPDATE vehicles SET status = $1 WHERE id = $2',
        ['rented', vehicle.id]
      );
      
      await client.query(`
        INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        rentalResult.rows[0].id, agency_id, user_id, totalAmount,
        'rental', payment.rental_method, `Alquiler ${contractNumber}`
      ]);
      
      if (deposit > 0) {
        await client.query(`
          INSERT INTO payments (rental_id, agency_id, user_id, amount, payment_type, payment_method, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          rentalResult.rows[0].id, agency_id, user_id, deposit,
          'deposit', payment.deposit_method, `Depósito ${contractNumber}`
        ]);
      }
    }
    
    await client.query('COMMIT');
    
    // 3. Envoyer l'email avec le contrat PDF (async)
    if (customer.email && rentalIds.length > 0) {
      sendContractEmailWithPDF(pool, customer, vehicles, contracts, rentalIds[0], start_date, planned_end_date, payment)
        .catch(err => console.error('Erreur envoi email:', err));
    }
    
    res.json({
      success: true,
      rental_ids: rentalIds,
      contracts: contracts,
      customer_id: customerId
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en check-in:', error);
    res.status(500).json({ error: 'Error al procesar el check-in: ' + error.message });
  } finally {
    client.release();
  }
});

// Fonction pour envoyer l'email du contrat avec PDF
async function sendContractEmailWithPDF(pool, customer, vehicles, contracts, rentalId, start_date, planned_end_date, payment) {
  const lang = customer.preferred_language || 'es';
  
  // Générer le PDF
  const pdfBase64 = await generateContractPDF(rentalId, pool);
  
  // Préparer les données pour l'email
  const vehicleNames = vehicles.map(v => `${v.code}`).join(', ');
  const start = new Date(start_date);
  const end = new Date(planned_end_date);
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  
  const totalAmount = vehicles.reduce((sum, v) => sum + (days * parseFloat(v.daily_rate)), 0);
  const totalDeposit = vehicles.reduce((sum, v) => sum + (parseFloat(v.deposit) || 0), 0);
  
  const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const startDateFormatted = start.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'es-ES', dateOptions);
  const endDateFormatted = end.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'es-ES', dateOptions);
  
  const emailData = {
    customer_name: `${customer.first_name} ${customer.last_name}`,
    contract_number: contracts.join(', '),
    vehicle: vehicleNames,
    start_date: startDateFormatted,
    end_date: endDateFormatted,
    total: totalAmount.toFixed(2),
    deposit: totalDeposit.toFixed(2)
  };
  
  const template = getContractEmailTemplate(emailData, lang);
  
  // Préparer les pièces jointes
  const attachments = [];
  if (pdfBase64) {
    attachments.push({
      filename: `contrato-${contracts[0]}.pdf`,
      content: pdfBase64
    });
  }
  
  const result = await sendEmail({
    to: customer.email,
    subject: template.subject,
    html: template.html,
    attachments: attachments
  });
  
  if (result.success) {
    console.log(`✅ Email contrat + PDF envoyé à ${customer.email}`);
  } else {
    console.error(`❌ Erreur envoi email à ${customer.email}:`, result.error);
  }
  
  return result;
}

module.exports = router;
