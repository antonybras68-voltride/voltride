const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');

// Génération de contrat PDF
router.get('/:rentalId/pdf', async (req, res) => {
  const { rentalId } = req.params;
  const pool = req.app.get('pool');
  
  try {
    const rentalResult = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, 
        c.id_type, c.id_number, c.address, c.city, c.country,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model, v.color,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone,
        u.full_name as employee_name
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (rentalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const rental = rentalResult.rows[0];
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrato-${rental.contract_number}.pdf`);
    doc.pipe(res);
    
    // EN-TÊTE
    doc.fontSize(28).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
    doc.fontSize(10).fillColor('#666').text('Alquiler de Bicicletas y Patinetes Electricos', 50, 85);
    doc.fontSize(12).fillColor('#333').text('CONTRATO DE ALQUILER', 400, 50, { align: 'right' });
    doc.fontSize(14).fillColor('#f59e0b').text(rental.contract_number, 400, 68, { align: 'right' });
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#f59e0b').lineWidth(2).stroke();
    
    // DATOS EMPRESA
    let y = 130;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#333').text('DATOS DE LA EMPRESA', 50, y);
    doc.font('Helvetica').fontSize(10);
    y += 18;
    doc.text('Voltride - Alquiler de Vehiculos', 50, y);
    y += 14;
    doc.text('Torrevieja, Alicante, Espana', 50, y);
    y += 14;
    doc.text('CIF: B12345678', 50, y);
    
    // DATOS CLIENTE
    y = 130;
    doc.font('Helvetica-Bold').fontSize(11).text('DATOS DEL CLIENTE', 300, y);
    doc.font('Helvetica').fontSize(10);
    y += 18;
    doc.text(`${rental.first_name} ${rental.last_name}`, 300, y);
    y += 14;
    doc.text(`${rental.id_type || 'Documento'}: ${rental.id_number || 'N/A'}`, 300, y);
    y += 14;
    doc.text(`Tel: ${rental.phone || 'N/A'}`, 300, y);
    y += 14;
    doc.text(`${rental.email || ''}`, 300, y);
    
    // VEHICULO
    y = 230;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').lineWidth(1).stroke();
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11).text('VEHICULO ALQUILADO', 50, y);
    y += 20;
    
    const vehicleType = { 'bike': 'Bicicleta', 'ebike': 'Bicicleta Electrica', 'scooter': 'Patinete Electrico' }[rental.vehicle_type] || rental.vehicle_type;
    doc.rect(50, y, 495, 50).fillColor('#f5f5f5').fill();
    doc.fillColor('#333').font('Helvetica').fontSize(10);
    y += 12;
    doc.text(`Codigo: ${rental.vehicle_code}`, 60, y);
    doc.text(`Tipo: ${vehicleType}`, 200, y);
    doc.text(`Marca: ${rental.brand || '-'}`, 350, y);
    y += 18;
    doc.text(`Modelo: ${rental.model || '-'}`, 60, y);
    doc.text(`Color: ${rental.color || '-'}`, 200, y);
    
    // PERIODO
    y += 40;
    doc.font('Helvetica-Bold').fontSize(11).text('PERIODO DE ALQUILER', 50, y);
    y += 20;
    
    const startDate = new Date(rental.start_date);
    const endDate = rental.end_date ? new Date(rental.end_date) : new Date(rental.planned_end_date);
    const formatDate = (d) => d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    
    const diffHours = Math.abs(endDate - startDate) / (1000 * 60 * 60);
    let days = Math.floor(diffHours / 24);
    if (diffHours % 24 > 1) days++;
    days = Math.max(1, days);
    
    doc.rect(50, y, 495, 45).fillColor('#f5f5f5').fill();
    doc.fillColor('#333').font('Helvetica').fontSize(10);
    y += 12;
    doc.text(`Inicio: ${formatDate(startDate)}`, 60, y);
    doc.text(`Fin: ${formatDate(endDate)}`, 300, y);
    y += 18;
    doc.text(`Duracion: ${days} dia(s)`, 60, y);
    
    // PRECIOS
    y += 45;
    doc.font('Helvetica-Bold').fontSize(11).text('DESGLOSE ECONOMICO', 50, y);
    y += 20;
    
    doc.rect(50, y, 495, 85).strokeColor('#ddd').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(10);
    y += 12;
    doc.text('Concepto', 60, y);
    doc.text('Importe', 480, y, { align: 'right' });
    doc.moveTo(50, y + 12).lineTo(545, y + 12).strokeColor('#eee').stroke();
    
    y += 22;
    doc.text(`Alquiler (${days} dia(s) x ${parseFloat(rental.daily_rate).toFixed(2)} EUR)`, 60, y);
    doc.text(`${parseFloat(rental.total_amount || 0).toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 16;
    doc.text('Deposito/Fianza', 60, y);
    doc.text(`${parseFloat(rental.deposit || 0).toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 16;
    doc.font('Helvetica-Bold');
    const total = parseFloat(rental.total_amount || 0) + parseFloat(rental.deposit || 0);
    doc.text('TOTAL', 60, y);
    doc.text(`${total.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    // CONDITIONS
    y += 35;
    doc.font('Helvetica-Bold').fontSize(11).text('CONDICIONES GENERALES', 50, y);
    y += 15;
    doc.font('Helvetica').fontSize(8).fillColor('#666');
    const conditions = [
      '1. El cliente se compromete a devolver el vehiculo en el mismo estado en que lo recibio.',
      '2. El cliente es responsable de cualquier dano o perdida del vehiculo durante el alquiler.',
      '3. El deposito sera devuelto integramente si el vehiculo se devuelve sin danos.',
      '4. En caso de retraso en la devolucion, se aplicara un cargo adicional por dia.',
      '5. El cliente debe respetar el codigo de circulacion vigente.',
      '6. Esta prohibido el uso del vehiculo bajo los efectos del alcohol o drogas.',
      '7. El vehiculo no puede ser subalquilado ni prestado a terceros.'
    ];
    conditions.forEach(c => { doc.text(c, 50, y, { width: 495 }); y += 11; });
    
    // FIRMAS
    y += 20;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#333').text('FIRMAS', 50, y);
    y += 15;
    doc.rect(50, y, 180, 70).strokeColor('#ddd').stroke();
    doc.rect(315, y, 180, 70).strokeColor('#ddd').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#666');
    doc.text('Firma del Cliente', 50, y + 75);
    doc.text(`${rental.first_name} ${rental.last_name}`, 50, y + 87);
    doc.text('Firma Voltride', 315, y + 75);
    
    // PIED DE PAGE
    doc.fontSize(8).fillColor('#999');
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 50, 780, { align: 'center', width: 495 });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando contrato:', error);
    res.status(500).json({ error: 'Error generando el contrato' });
  }
});

module.exports = router;
