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

// GET /api/invoices/:rentalId/pdf - Générer la facture PDF
router.get('/:rentalId/pdf', async (req, res) => {
  const pool = req.app.get('pool');
  const { rentalId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.address, c.id_number, c.id_type,
        c.preferred_language,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone, a.email as agency_email
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location non trouvée' });
    }
    
    const rental = result.rows[0];
    const logoBuffer = getLogoBuffer();
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=factura-${rental.contract_number}.pdf`);
    
    doc.pipe(res);
    
    // === EN-TÊTE AVEC LOGO ===
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 40, { width: 120 });
      } catch (e) {
        doc.fontSize(24).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
      }
    } else {
      doc.fontSize(24).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
    }
    
    // Infos agence
    doc.fontSize(9).fillColor('#666')
       .text(rental.agency_name || 'Voltride', 50, 100)
       .text(rental.agency_address || '', 50, 112)
       .text(rental.agency_phone || '', 50, 124);
    
    // Titre FACTURA
    doc.fontSize(28).fillColor('#10b981').text('FACTURA', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#666')
       .text(`N°: F-${rental.contract_number}`, 350, 85, { align: 'right' })
       .text(`Fecha: ${new Date(rental.end_date || new Date()).toLocaleDateString('es-ES')}`, 350, 100, { align: 'right' });
    
    // Ligne séparatrice
    doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#10b981').lineWidth(2).stroke();
    
    // === CLIENT ===
    let y = 165;
    doc.fontSize(12).fillColor('#10b981').text('CLIENTE', 50, y);
    y += 20;
    doc.fontSize(10).fillColor('#333')
       .text(`${rental.first_name} ${rental.last_name}`, 50, y);
    if (rental.id_number) {
      y += 14;
      doc.text(`${(rental.id_type || 'ID').toUpperCase()}: ${rental.id_number}`, 50, y);
    }
    if (rental.email) {
      y += 14;
      doc.text(`Email: ${rental.email}`, 50, y);
    }
    if (rental.phone) {
      y += 14;
      doc.text(`Tel: ${rental.phone}`, 50, y);
    }
    
    // === DÉTAIL ===
    y += 30;
    doc.fontSize(12).fillColor('#10b981').text('DETALLE DEL ALQUILER', 50, y);
    y += 25;
    
    const col1 = 50, col2 = 300, col3 = 400, col4 = 500;
    
    // En-tête tableau
    doc.rect(50, y - 5, 495, 22).fillColor('#f0fdf4').fill();
    doc.fontSize(9).fillColor('#666')
       .text('Descripcion', col1 + 10, y)
       .text('Cantidad', col2, y)
       .text('Precio', col3, y)
       .text('Total', col4, y);
    y += 28;
    
    // Calculs
    const startDate = new Date(rental.start_date);
    const endDate = new Date(rental.end_date || rental.planned_end_date);
    const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const dailyRate = parseFloat(rental.daily_rate) || 0;
    const rentalTotal = parseFloat(rental.total_amount) || (days * dailyRate);
    
    // Ligne véhicule
    doc.fontSize(10).fillColor('#333')
       .text(`${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, col1, y)
       .text(`${days} dia(s)`, col2, y)
       .text(`${dailyRate.toFixed(2)} EUR`, col3, y)
       .text(`${rentalTotal.toFixed(2)} EUR`, col4, y);
    y += 20;
    
    // Accessoires
    if (rental.notes && rental.notes.includes('Accesorios:')) {
      const accStr = rental.notes.replace('Accesorios:', '').trim();
      const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
      doc.fontSize(9).fillColor('#666');
      accessories.forEach(acc => {
        doc.text(`   - ${acc}`, col1, y).text('Incluido', col4, y);
        y += 14;
      });
    }
    
    // Ligne séparatrice
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 15;
    
    // === DÉDUCTIONS ===
    const deductions = parseFloat(rental.checkout_deductions) || 0;
    if (deductions > 0) {
      doc.fontSize(11).fillColor('#e74c3c').text('DEDUCCIONES:', col1, y);
      y += 18;
      
      if (rental.checkout_notes) {
        const deductionsList = rental.checkout_notes.split(',').map(d => d.trim());
        doc.fontSize(9).fillColor('#666');
        deductionsList.forEach(ded => {
          doc.text(`  - ${ded}`, col1 + 10, y);
          y += 14;
        });
      }
      
      y += 5;
      doc.fontSize(10).fillColor('#333').text(`Total deducciones:`, col3, y);
      doc.fillColor('#e74c3c').text(`-${deductions.toFixed(2)} EUR`, col4, y);
      y += 25;
    }
    
    // === TOTAUX ===
    const deposit = parseFloat(rental.deposit) || 0;
    const depositRefund = parseFloat(rental.checkout_refund) || (deposit - deductions);
    const rentalHT = rentalTotal / 1.21;
    const tva = rentalTotal - rentalHT;
    
    // Ligne séparatrice avant totaux
    doc.moveTo(300, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 15;
    
    doc.fontSize(10).fillColor('#666');
    doc.text('Base imponible:', col3, y);
    doc.fillColor('#333').text(`${rentalHT.toFixed(2)} EUR`, col4, y);
    y += 18;
    
    doc.fillColor('#666').text('IVA 21%:', col3, y);
    doc.fillColor('#333').text(`${tva.toFixed(2)} EUR`, col4, y);
    y += 25;
    
    // Total TTC
    doc.rect(col3 - 20, y - 5, 185, 28).fillColor('#10b981').fill();
    doc.fontSize(11).fillColor('#fff')
       .text('TOTAL:', col3 - 10, y + 2)
       .text(`${rentalTotal.toFixed(2)} EUR`, col4, y + 2);
    y += 45;
    
    // === DÉPÔT ===
    doc.fontSize(10).fillColor('#333');
    doc.text(`Deposito pagado:`, col3, y);
    doc.text(`${deposit.toFixed(2)} EUR`, col4, y);
    y += 18;
    
    if (deductions > 0) {
      doc.fillColor('#e74c3c').text(`Deducciones:`, col3, y);
      doc.text(`-${deductions.toFixed(2)} EUR`, col4, y);
      y += 18;
    }
    
    // Encadré dépôt remboursé
    doc.rect(col3 - 20, y - 5, 185, 28).fillColor('#ecfdf5').fill();
    doc.rect(col3 - 20, y - 5, 185, 28).strokeColor('#10b981').stroke();
    doc.fontSize(10).fillColor('#10b981').text(`Deposito devuelto:`, col3 - 10, y + 2);
    doc.fontSize(12).fillColor('#10b981').text(`${depositRefund.toFixed(2)} EUR`, col4, y);
    
    // === PIED DE PAGE ===
    doc.fontSize(14).fillColor('#10b981').text('Gracias por confiar en Voltride!', 50, 700, { align: 'center' });
    
    doc.fontSize(8).fillColor('#999')
       .text(`Voltride - ${rental.agency_name || ''} | ${rental.agency_email || 'info@voltride.es'} | ${rental.agency_phone || ''}`, 50, 750, { align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

module.exports = router;
