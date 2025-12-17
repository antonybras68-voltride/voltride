const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Charger le logo
function getLogoBuffer() {
  try {
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  return null;
}

// GET /api/contracts/:rentalId/pdf
router.get('/:rentalId/pdf', async (req, res) => {
  const pool = req.app.get('pool');
  const { rentalId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.address, c.id_number, c.id_type, c.country,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model, v.color,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone, a.email as agency_email
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const rental = result.rows[0];
    const logoBuffer = getLogoBuffer();
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=contrato-${rental.contract_number}.pdf`);
    
    doc.pipe(res);
    
    // === EN-TÊTE AVEC LOGO ===
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 30, { width: 100 });
      } catch (e) {
        doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
      }
    } else {
      doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
    }
    
    // Titre à droite
    doc.fontSize(16).fillColor('#333').text('CONTRATO DE ALQUILER', 300, 35, { width: 245, align: 'right' });
    doc.fontSize(12).fillColor('#f59e0b').text(rental.contract_number, 300, 55, { width: 245, align: 'right' });
    
    // Ligne séparatrice
    doc.moveTo(50, 85).lineTo(545, 85).strokeColor('#f59e0b').lineWidth(2).stroke();
    
    // === DONNÉES ENTREPRISE ET CLIENT (2 colonnes) ===
    let y = 100;
    
    // Colonne gauche - Entreprise
    doc.fontSize(10).fillColor('#f59e0b').text('DATOS DE LA EMPRESA', 50, y);
    y += 15;
    doc.fontSize(9).fillColor('#333')
       .text('Antony Felicien Bras', 50, y)
       .text('Av. Doctor Mariano Ruiz Canovas 7', 50, y + 12)
       .text('03183 Torrevieja, Alicante', 50, y + 24)
       .text('NIE: Z0320770V', 50, y + 36)
       .text('Tel: +34 635 992 987', 50, y + 48);
    
    // Colonne droite - Client
    doc.fontSize(10).fillColor('#f59e0b').text('DATOS DEL CLIENTE', 300, 100);
    doc.fontSize(9).fillColor('#333')
       .text(`${rental.first_name} ${rental.last_name}`, 300, 115)
       .text(`${(rental.id_type || 'DNI').toUpperCase()}: ${rental.id_number || '-'}`, 300, 127)
       .text(`Tel: ${rental.phone || '-'}`, 300, 139)
       .text(rental.email || '-', 300, 151);
    
    // Ligne séparatrice
    y = 175;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#eee').lineWidth(1).stroke();
    
    // === VÉHICULE ===
    y = 190;
    doc.fontSize(10).fillColor('#333').text('VEHICULO ALQUILADO', 50, y, { underline: true });
    y += 18;
    
    doc.fontSize(9).fillColor('#666');
    doc.text(`Codigo: ${rental.vehicle_code}`, 50, y);
    doc.text(`Tipo: ${rental.vehicle_type === 'bike' ? 'Bicicleta' : rental.vehicle_type === 'ebike' ? 'Bicicleta Electrica' : 'Scooter'}`, 200, y);
    doc.text(`Marca: ${rental.brand || '-'}`, 380, y);
    y += 14;
    doc.text(`Modelo: ${rental.model || '-'}`, 50, y);
    doc.text(`Color: ${rental.color || '-'}`, 200, y);
    
    // Ligne séparatrice
    y += 25;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#eee').lineWidth(1).stroke();
    
    // === PÉRIODE ===
    y += 15;
    doc.fontSize(10).fillColor('#333').text('PERIODO DE ALQUILER', 50, y, { underline: true });
    y += 18;
    
    const startDate = new Date(rental.start_date);
    const endDate = new Date(rental.planned_end_date);
    const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    doc.fontSize(9).fillColor('#666');
    doc.text(`Inicio: ${startDate.toLocaleDateString('es-ES')} ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
    doc.text(`Fin: ${endDate.toLocaleDateString('es-ES')} ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 280, y);
    y += 14;
    doc.text(`Duracion: ${days} dia(s)`, 50, y);
    
    // Ligne séparatrice
    y += 25;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#eee').lineWidth(1).stroke();
    
    // === DÉCOMPTE ÉCONOMIQUE ===
    y += 15;
    doc.fontSize(10).fillColor('#333').text('DESGLOSE ECONOMICO', 50, y, { underline: true });
    y += 18;
    
    const dailyRate = parseFloat(rental.daily_rate) || 0;
    const totalAmount = parseFloat(rental.total_amount) || (days * dailyRate);
    const deposit = parseFloat(rental.deposit) || 0;
    const baseHT = totalAmount / 1.21;
    const tva = totalAmount - baseHT;
    
    // Tableau économique
    doc.rect(50, y, 495, 18).fillColor('#f5f5f5').fill();
    doc.fontSize(9).fillColor('#333').text('Concepto', 60, y + 4).text('Importe', 480, y + 4);
    y += 22;
    
    doc.fillColor('#666');
    doc.text(`Base imponible (${days} dia(s) x ${baseHT.toFixed(2)} EUR)`, 60, y);
    doc.text(`${baseHT.toFixed(2)} EUR`, 470, y);
    y += 16;
    doc.text('IVA 21%', 60, y);
    doc.text(`${tva.toFixed(2)} EUR`, 470, y);
    y += 16;
    doc.fillColor('#333').text('Subtotal (Alquiler)', 60, y);
    doc.text(`${totalAmount.toFixed(2)} EUR`, 470, y);
    y += 16;
    doc.fillColor('#666').text('Deposito/Fianza (reembolsable)', 60, y);
    doc.text(`${deposit.toFixed(2)} EUR`, 470, y);
    y += 18;
    
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#333').lineWidth(1).stroke();
    y += 5;
    doc.fontSize(10).fillColor('#333').text('TOTAL', 60, y);
    doc.fontSize(10).fillColor('#333').text(`${(totalAmount + deposit).toFixed(2)} EUR`, 460, y);
    
    // === FORMA DE PAGO ===
    y += 25;
    doc.fontSize(10).fillColor('#333').text('FORMA DE PAGO', 50, y, { underline: true });
    y += 15;
    doc.fontSize(9).fillColor('#666');
    doc.text(`Pago alquiler: ${rental.payment_method === 'cash' ? 'Efectivo' : rental.payment_method === 'card' ? 'Tarjeta' : rental.payment_method || 'Tarjeta'}`, 50, y);
    doc.text(`Pago deposito: ${rental.deposit_method === 'preauth' ? 'Pre-autorizacion' : rental.deposit_method === 'cash' ? 'Efectivo' : 'Tarjeta'}`, 280, y);
    
    // === CONDITIONS ===
    y += 25;
    doc.fontSize(10).fillColor('#333').text('CONDICIONES GENERALES', 50, y, { underline: true });
    y += 15;
    
    const conditions = [
      'El cliente se compromete a devolver el vehiculo en el mismo estado en que lo recibio.',
      'El cliente es responsable de cualquier dano o perdida del vehiculo durante el alquiler.',
      'El deposito sera devuelto integramente si el vehiculo se devuelve sin danos.',
      'En caso de retraso en la devolucion, se aplicara un cargo adicional por dia.',
      'El cliente debe respetar el codigo de circulacion vigente.',
      'Esta prohibido el uso del vehiculo bajo los efectos del alcohol o drogas.',
      'El vehiculo no puede ser subalquilado ni prestado a terceros.',
      'En caso de averia, contactar inmediatamente con la agencia.',
      'Entre las 21h y las 7h, el vehiculo debe estar guardado en un lugar cerrado y seguro. En caso de robo, el cliente debera abonar el importe total del vehiculo.',
      'Si el vehiculo se devuelve sucio, se aplicara un cargo de 6 EUR que se facturara o deducira del deposito.'
    ];
    
    doc.fontSize(7).fillColor('#666');
    conditions.forEach((cond, i) => {
      doc.text(`${i + 1}. ${cond}`, 50, y, { width: 500 });
      y += 11;
    });
    
    // === SIGNATURE CLIENT ===
    y += 15;
    doc.fontSize(10).fillColor('#333').text('FIRMA', 50, y, { underline: true });
    y += 15;
    
    // Encadré signature
    doc.rect(50, y, 200, 70).strokeColor('#ccc').stroke();
    
    // Afficher la signature si elle existe
    if (rental.signature) {
      try {
        let signatureData = rental.signature;
        if (signatureData.includes('base64,')) {
          signatureData = signatureData.split('base64,')[1];
        }
        const signatureBuffer = Buffer.from(signatureData, 'base64');
        doc.image(signatureBuffer, 55, y + 5, { width: 190, height: 60, fit: [190, 60] });
      } catch (e) {
        console.error('Error loading signature:', e);
      }
    }
    
    // Légende sous la signature
    y += 75;
    doc.fontSize(8).fillColor('#666')
       .text('Firma del Cliente', 50, y)
       .text(`${rental.first_name} ${rental.last_name}`, 50, y + 10);
    
    // === MENTION VOLTRIDE ===
    y += 35;
    doc.fontSize(9).fillColor('#333').text('Contrato emitido por Voltride (Z0320770V)', 50, y);
    
    // === PIED DE PAGE ===
    doc.fontSize(7).fillColor('#999')
       .text(`Generado el ${new Date().toLocaleDateString('es-ES')} - Voltride - Just Rent and Ride`, 50, 800, { align: 'center', width: 495 });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    res.status(500).json({ error: 'Error generating contract' });
  }
});

module.exports = router;
