const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { authMiddleware } = require('./auth');

// GET /api/invoices/:rentalId/pdf - Générer la facture PDF
router.get('/:rentalId/pdf', async (req, res) => {
  const pool = req.app.get('pool');
  const { rentalId } = req.params;
  
  try {
    // Récupérer les données de la location
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.address, c.id_number, c.id_type,
        c.preferred_language,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone
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
    const lang = rental.preferred_language || 'es';
    
    // Créer le PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=factura-${rental.contract_number}.pdf`);
    
    doc.pipe(res);
    
    // Textes multilingues
    const texts = {
      es: {
        invoice: 'FACTURA',
        invoiceNumber: 'Nº Factura',
        date: 'Fecha',
        client: 'CLIENTE',
        rental: 'DETALLE DEL ALQUILER',
        vehicle: 'Vehículo',
        period: 'Período',
        days: 'días',
        unitPrice: 'Precio/día',
        subtotal: 'Subtotal',
        deposit: 'Depósito pagado',
        deductions: 'Deducciones',
        depositRefund: 'Depósito devuelto',
        total: 'TOTAL PAGADO',
        baseHT: 'Base imponible',
        vat: 'IVA 21%',
        totalTTC: 'Total (IVA incl.)',
        paymentMethod: 'Método de pago',
        thankYou: '¡Gracias por confiar en Voltride!',
        footer: 'Voltride - Alquiler de bicicletas y vehículos eléctricos'
      },
      fr: {
        invoice: 'FACTURE',
        invoiceNumber: 'N° Facture',
        date: 'Date',
        client: 'CLIENT',
        rental: 'DÉTAIL DE LA LOCATION',
        vehicle: 'Véhicule',
        period: 'Période',
        days: 'jours',
        unitPrice: 'Prix/jour',
        subtotal: 'Sous-total',
        deposit: 'Caution payée',
        deductions: 'Déductions',
        depositRefund: 'Caution remboursée',
        total: 'TOTAL PAYÉ',
        baseHT: 'Base HT',
        vat: 'TVA 21%',
        totalTTC: 'Total (TTC)',
        paymentMethod: 'Mode de paiement',
        thankYou: 'Merci de votre confiance !',
        footer: 'Voltride - Location de vélos et véhicules électriques'
      },
      en: {
        invoice: 'INVOICE',
        invoiceNumber: 'Invoice No.',
        date: 'Date',
        client: 'CLIENT',
        rental: 'RENTAL DETAILS',
        vehicle: 'Vehicle',
        period: 'Period',
        days: 'days',
        unitPrice: 'Price/day',
        subtotal: 'Subtotal',
        deposit: 'Deposit paid',
        deductions: 'Deductions',
        depositRefund: 'Deposit refunded',
        total: 'TOTAL PAID',
        baseHT: 'Net amount',
        vat: 'VAT 21%',
        totalTTC: 'Total (incl. VAT)',
        paymentMethod: 'Payment method',
        thankYou: 'Thank you for choosing Voltride!',
        footer: 'Voltride - Bike and electric vehicle rental'
      }
    };
    
    const t = texts[lang] || texts.es;
    
    // Calculs
    const startDate = new Date(rental.start_date);
    const endDate = new Date(rental.end_date || rental.planned_end_date);
    const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    const rentalTTC = parseFloat(rental.total_amount) || (days * parseFloat(rental.daily_rate));
    const rentalHT = rentalTTC / 1.21;
    const vatAmount = rentalTTC - rentalHT;
    const depositPaid = parseFloat(rental.deposit) || 0;
    const deductions = parseFloat(rental.checkout_deductions) || 0;
    const depositRefunded = parseFloat(rental.checkout_refund) || (depositPaid - deductions);
    
    const invoiceNumber = `F-${rental.contract_number}`;
    const invoiceDate = rental.end_date ? new Date(rental.end_date) : new Date();
    
    // === EN-TÊTE ===
    doc.fontSize(24).fillColor('#f59e0b').text('⚡ VOLTRIDE', 50, 50);
    doc.fontSize(10).fillColor('#666')
       .text(rental.agency_name || 'Voltride', 50, 80)
       .text(rental.agency_address || '', 50, 95)
       .text(rental.agency_phone || '', 50, 110);
    
    // Titre facture
    doc.fontSize(28).fillColor('#333').text(t.invoice, 350, 50, { align: 'right' });
    doc.fontSize(11).fillColor('#666')
       .text(`${t.invoiceNumber}: ${invoiceNumber}`, 350, 85, { align: 'right' })
       .text(`${t.date}: ${invoiceDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'es-ES')}`, 350, 100, { align: 'right' });
    
    // Ligne séparatrice
    doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#ddd').stroke();
    
    // === CLIENT ===
    let y = 160;
    doc.fontSize(12).fillColor('#f59e0b').text(t.client, 50, y);
    y += 20;
    doc.fontSize(11).fillColor('#333')
       .text(`${rental.first_name} ${rental.last_name}`, 50, y);
    y += 15;
    if (rental.id_number) {
      doc.text(`${rental.id_type?.toUpperCase() || 'ID'}: ${rental.id_number}`, 50, y);
      y += 15;
    }
    if (rental.email) {
      doc.text(rental.email, 50, y);
      y += 15;
    }
    if (rental.phone) {
      doc.text(rental.phone, 50, y);
      y += 15;
    }
    if (rental.address) {
      doc.text(rental.address, 50, y);
      y += 15;
    }
    
    // === DÉTAIL LOCATION ===
    y += 20;
    doc.fontSize(12).fillColor('#f59e0b').text(t.rental, 50, y);
    y += 25;
    
    // Tableau
    const tableTop = y;
    const col1 = 50, col2 = 250, col3 = 350, col4 = 450;
    
    // En-tête tableau
    doc.fontSize(10).fillColor('#666')
       .text('Description', col1, tableTop)
       .text(t.unitPrice, col2, tableTop)
       .text('Qté', col3, tableTop)
       .text('Total', col4, tableTop);
    
    y = tableTop + 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 10;
    
    // Ligne véhicule
    const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
    doc.fontSize(11).fillColor('#333')
       .text(`${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, col1, y)
       .text(`${parseFloat(rental.daily_rate).toFixed(2)} €`, col2, y)
       .text(`${days} ${t.days}`, col3, y)
       .text(`${rentalTTC.toFixed(2)} €`, col4, y);
    
    y += 30;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    
    // === TOTAUX ===
    y += 20;
    
    // Base HT
    doc.fontSize(10).fillColor('#666').text(t.baseHT, col3, y);
    doc.fillColor('#333').text(`${rentalHT.toFixed(2)} €`, col4, y);
    y += 18;
    
    // TVA
    doc.fillColor('#666').text(t.vat, col3, y);
    doc.fillColor('#333').text(`${vatAmount.toFixed(2)} €`, col4, y);
    y += 18;
    
    // Total TTC
    doc.fillColor('#666').text(t.totalTTC, col3, y);
    doc.fontSize(11).fillColor('#333').text(`${rentalTTC.toFixed(2)} €`, col4, y);
    y += 25;
    
    // Ligne
    doc.moveTo(350, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 15;
    
    // Dépôt
    doc.fontSize(10).fillColor('#666').text(t.deposit, col3, y);
    doc.fillColor('#333').text(`${depositPaid.toFixed(2)} €`, col4, y);
    y += 18;
    
    // Déductions (si applicable)
    if (deductions > 0) {
      doc.fillColor('#666').text(t.deductions, col3, y);
      doc.fillColor('#e74c3c').text(`-${deductions.toFixed(2)} €`, col4, y);
      y += 18;
    }
    
    // Dépôt remboursé
    doc.fillColor('#666').text(t.depositRefund, col3, y);
    doc.fillColor('#27ae60').text(`${depositRefunded.toFixed(2)} €`, col4, y);
    y += 30;
    
    // TOTAL FINAL
    doc.rect(340, y - 5, 210, 35).fillColor('#f59e0b').fill();
    doc.fontSize(12).fillColor('#fff').text(t.total, 350, y + 5);
    doc.fontSize(14).text(`${rentalTTC.toFixed(2)} €`, col4, y + 3);
    
    // === PIED DE PAGE ===
    y = 700;
    doc.fontSize(12).fillColor('#27ae60').text(t.thankYou, 50, y, { align: 'center' });
    
    y += 30;
    doc.fontSize(9).fillColor('#999').text(t.footer, 50, y, { align: 'center' });
    doc.text('NIF: B12345678 | info@voltride.es | +34 600 000 001', 50, y + 15, { align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

module.exports = router;
