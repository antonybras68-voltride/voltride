const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Conditions générales multilingues
const conditions = {
  es: [
    '1. El cliente se compromete a devolver el vehiculo en el mismo estado en que lo recibio.',
    '2. El cliente es responsable de cualquier dano o perdida del vehiculo durante el alquiler.',
    '3. El deposito sera devuelto integramente si el vehiculo se devuelve sin danos.',
    '4. En caso de retraso en la devolucion, se aplicara un cargo adicional por dia.',
    '5. El cliente debe respetar el codigo de circulacion vigente.',
    '6. Esta prohibido el uso del vehiculo bajo los efectos del alcohol o drogas.',
    '7. El vehiculo no puede ser subalquilado ni prestado a terceros.',
    '8. En caso de averia, contactar inmediatamente con la agencia.',
    '9. Entre las 21h y las 7h, el vehiculo debe estar guardado en un lugar cerrado y seguro. En caso de robo, el cliente debera abonar el importe total del vehiculo.',
    '10. Si el vehiculo se devuelve sucio, se aplicara un cargo de 5 EUR que se facturara o deducira del deposito.'
  ],
  fr: [
    '1. Le client s\'engage a restituer le vehicule dans le meme etat qu\'a la reception.',
    '2. Le client est responsable de tout dommage ou perte du vehicule pendant la location.',
    '3. La caution sera integralement restituee si le vehicule est rendu sans dommages.',
    '4. En cas de retard dans la restitution, un supplement journalier sera applique.',
    '5. Le client doit respecter le code de la route en vigueur.',
    '6. L\'utilisation du vehicule sous l\'influence de l\'alcool ou de drogues est interdite.',
    '7. Le vehicule ne peut etre sous-loue ni prete a des tiers.',
    '8. En cas de panne, contacter immediatement l\'agence.',
    '9. Entre 21h et 7h, le vehicule doit etre stationne dans un endroit clos et securise. En cas de vol, le client devra payer le montant total du vehicule.',
    '10. Si le vehicule est rendu sale, des frais de 5 EUR seront factures ou deduits de la caution.'
  ],
  en: [
    '1. The customer agrees to return the vehicle in the same condition as received.',
    '2. The customer is responsible for any damage or loss of the vehicle during the rental.',
    '3. The deposit will be fully refunded if the vehicle is returned without damage.',
    '4. In case of late return, an additional daily charge will be applied.',
    '5. The customer must comply with current traffic regulations.',
    '6. Use of the vehicle under the influence of alcohol or drugs is prohibited.',
    '7. The vehicle cannot be sublet or lent to third parties.',
    '8. In case of breakdown, contact the agency immediately.',
    '9. Between 9pm and 7am, the vehicle must be stored in a closed and secure location. In case of theft, the customer must pay the full amount of the vehicle.',
    '10. If the vehicle is returned dirty, a 5 EUR cleaning fee will be charged or deducted from the deposit.'
  ]
};

// Titres multilingues
const titles = {
  es: {
    contract: 'CONTRATO DE ALQUILER',
    companyData: 'DATOS DE LA EMPRESA',
    customerData: 'DATOS DEL CLIENTE',
    vehicle: 'VEHICULO ALQUILADO',
    period: 'PERIODO DE ALQUILER',
    breakdown: 'DESGLOSE ECONOMICO',
    conditions: 'CONDICIONES GENERALES',
    signatures: 'FIRMAS',
    customerSignature: 'Firma del Cliente',
    companySignature: 'Firma Voltride',
    generated: 'Generado el',
    code: 'Codigo',
    type: 'Tipo',
    brand: 'Marca',
    model: 'Modelo',
    color: 'Color',
    start: 'Inicio',
    end: 'Fin',
    duration: 'Duracion',
    days: 'dia(s)',
    concept: 'Concepto',
    amount: 'Importe',
    rental: 'Alquiler',
    baseAmount: 'Base imponible',
    vat: 'IVA',
    subtotal: 'Subtotal',
    deposit: 'Deposito/Fianza (reembolsable)',
    total: 'TOTAL',
    bike: 'Bicicleta',
    ebike: 'Bicicleta Electrica',
    scooter: 'Patinete Electrico',
    document: 'Documento',
    payment: 'FORMA DE PAGO',
    rentalPayment: 'Pago alquiler',
    depositPayment: 'Pago deposito',
    card: 'Tarjeta',
    cash: 'Efectivo',
    bizum: 'Bizum',
    preauth: 'Pre-autorizacion'
  },
  fr: {
    contract: 'CONTRAT DE LOCATION',
    companyData: 'DONNEES DE L\'ENTREPRISE',
    customerData: 'DONNEES DU CLIENT',
    vehicle: 'VEHICULE LOUE',
    period: 'PERIODE DE LOCATION',
    breakdown: 'DETAIL FINANCIER',
    conditions: 'CONDITIONS GENERALES',
    signatures: 'SIGNATURES',
    customerSignature: 'Signature du Client',
    companySignature: 'Signature Voltride',
    generated: 'Genere le',
    code: 'Code',
    type: 'Type',
    brand: 'Marque',
    model: 'Modele',
    color: 'Couleur',
    start: 'Debut',
    end: 'Fin',
    duration: 'Duree',
    days: 'jour(s)',
    concept: 'Concept',
    amount: 'Montant',
    rental: 'Location',
    baseAmount: 'Base HT',
    vat: 'TVA',
    subtotal: 'Sous-total',
    deposit: 'Caution (remboursable)',
    total: 'TOTAL',
    bike: 'Velo',
    ebike: 'Velo Electrique',
    scooter: 'Trottinette Electrique',
    document: 'Document',
    payment: 'MODE DE PAIEMENT',
    rentalPayment: 'Paiement location',
    depositPayment: 'Paiement caution',
    card: 'Carte',
    cash: 'Especes',
    bizum: 'Bizum',
    preauth: 'Pre-autorisation'
  },
  en: {
    contract: 'RENTAL CONTRACT',
    companyData: 'COMPANY INFORMATION',
    customerData: 'CUSTOMER INFORMATION',
    vehicle: 'RENTED VEHICLE',
    period: 'RENTAL PERIOD',
    breakdown: 'PRICE BREAKDOWN',
    conditions: 'TERMS AND CONDITIONS',
    signatures: 'SIGNATURES',
    customerSignature: 'Customer Signature',
    companySignature: 'Voltride Signature',
    generated: 'Generated on',
    code: 'Code',
    type: 'Type',
    brand: 'Brand',
    model: 'Model',
    color: 'Color',
    start: 'Start',
    end: 'End',
    duration: 'Duration',
    days: 'day(s)',
    concept: 'Concept',
    amount: 'Amount',
    rental: 'Rental',
    baseAmount: 'Base amount',
    vat: 'VAT',
    subtotal: 'Subtotal',
    deposit: 'Deposit (refundable)',
    total: 'TOTAL',
    bike: 'Bike',
    ebike: 'Electric Bike',
    scooter: 'Electric Scooter',
    document: 'Document',
    payment: 'PAYMENT METHOD',
    rentalPayment: 'Rental payment',
    depositPayment: 'Deposit payment',
    card: 'Card',
    cash: 'Cash',
    bizum: 'Bizum',
    preauth: 'Pre-authorization'
  }
};

// Generation de contrat PDF
router.get('/:rentalId/pdf', async (req, res) => {
  const { rentalId } = req.params;
  const pool = req.app.get('pool');
  
  try {
    const rentalResult = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, 
        c.id_type, c.id_number, c.address, c.city, c.country, c.preferred_language,
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
    const lang = rental.preferred_language || 'es';
    const t = titles[lang] || titles.es;
    const cond = conditions[lang] || conditions.es;
    
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrato-${rental.contract_number}.pdf`);
    doc.pipe(res);
    
    // ===== LOGO =====
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 25, { width: 130 });
      } catch (e) {
        doc.fontSize(24).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
      }
    } else {
      doc.fontSize(24).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
    }
    
    // ===== NUMERO DE CONTRAT =====
    doc.fontSize(11).fillColor('#333').font('Helvetica').text(t.contract, 350, 35, { align: 'right' });
    doc.fontSize(12).fillColor('#f59e0b').font('Helvetica-Bold').text(rental.contract_number, 350, 50, { align: 'right' });
    
    doc.moveTo(50, 90).lineTo(545, 90).strokeColor('#f59e0b').lineWidth(2).stroke();
    
    // ===== DONNEES ENTREPRISE =====
    let y = 105;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(t.companyData, 50, y);
    doc.font('Helvetica').fontSize(8);
    y += 13;
    doc.text('Antony Felicien Bras', 50, y);
    y += 11;
    doc.text('Av. Doctor Mariano Ruiz Canovas 7', 50, y);
    y += 11;
    doc.text('03183 Torrevieja, Alicante', 50, y);
    y += 11;
    doc.text('NIE: Z0320770V', 50, y);
    y += 11;
    doc.text('Tel: +34 635 992 987', 50, y);
    
    // ===== DONNEES CLIENT =====
    y = 105;
    doc.font('Helvetica-Bold').fontSize(9).text(t.customerData, 320, y);
    doc.font('Helvetica').fontSize(8);
    y += 13;
    doc.text(`${rental.first_name} ${rental.last_name}`, 320, y);
    y += 11;
    const idType = rental.id_type ? rental.id_type.toUpperCase() : t.document;
    doc.text(`${idType}: ${rental.id_number || 'N/A'}`, 320, y);
    y += 11;
    doc.text(`Tel: ${rental.phone || 'N/A'}`, 320, y);
    y += 11;
    if (rental.email) doc.text(rental.email, 320, y);
    
    // ===== VEHICULE =====
    y = 195;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').lineWidth(1).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(t.vehicle, 50, y);
    y += 15;
    
    const vehicleTypes = { bike: t.bike, ebike: t.ebike, scooter: t.scooter };
    const vehicleType = vehicleTypes[rental.vehicle_type] || rental.vehicle_type;
    
    doc.rect(50, y, 495, 35).fillColor('#f5f5f5').fill();
    doc.fillColor('#333').font('Helvetica').fontSize(8);
    y += 8;
    doc.text(`${t.code}: ${rental.vehicle_code}`, 60, y);
    doc.text(`${t.type}: ${vehicleType}`, 180, y);
    doc.text(`${t.brand}: ${rental.brand || '-'}`, 350, y);
    y += 13;
    doc.text(`${t.model}: ${rental.model || '-'}`, 60, y);
    doc.text(`${t.color}: ${rental.color || '-'}`, 180, y);
    
    // ===== PERIODE =====
    y += 25;
    doc.font('Helvetica-Bold').fontSize(9).text(t.period, 50, y);
    y += 15;
    
    const startDate = new Date(rental.start_date);
    const endDate = rental.end_date ? new Date(rental.end_date) : new Date(rental.planned_end_date);
    const formatDate = (d) => {
      const locale = lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'es-ES';
      return d.toLocaleDateString(locale) + ' ' + d.toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'});
    };
    
    const diffHours = Math.abs(endDate - startDate) / (1000 * 60 * 60);
    let days = Math.floor(diffHours / 24);
    if (diffHours % 24 > 1) days++;
    days = Math.max(1, days);
    
    doc.rect(50, y, 495, 30).fillColor('#f5f5f5').fill();
    doc.fillColor('#333').font('Helvetica').fontSize(8);
    y += 8;
    doc.text(`${t.start}: ${formatDate(startDate)}`, 60, y);
    doc.text(`${t.end}: ${formatDate(endDate)}`, 300, y);
    y += 12;
    doc.text(`${t.duration}: ${days} ${t.days}`, 60, y);
    
    // ===== DECOMPTE ECONOMIQUE (Prix TTC -> HT) =====
    y += 28;
    doc.font('Helvetica-Bold').fontSize(9).text(t.breakdown, 50, y);
    y += 15;
    
    // Prix TTC (ce qui est stocké en base)
    const dailyRate = parseFloat(rental.daily_rate) || 0;
    const rentalAmountTTC = days * dailyRate;
    
    // Calcul inverse TVA : TTC / 1.21 = HT
    const rentalAmountHT = rentalAmountTTC / 1.21;
    const vatAmount = rentalAmountTTC - rentalAmountHT;
    
    const deposit = parseFloat(rental.deposit) || 0;
    const total = rentalAmountTTC + deposit;
    
    doc.rect(50, y, 495, 80).strokeColor('#ddd').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(8);
    y += 8;
    doc.text(t.concept, 60, y);
    doc.text(t.amount, 480, y, { align: 'right' });
    doc.moveTo(50, y + 10).lineTo(545, y + 10).strokeColor('#eee').stroke();
    
    doc.font('Helvetica').fontSize(8);
    y += 16;
    doc.text(`${t.baseAmount} (${days} ${t.days} x ${(dailyRate / 1.21).toFixed(2)} EUR)`, 60, y);
    doc.text(`${rentalAmountHT.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 12;
    doc.text(`${t.vat} 21%`, 60, y);
    doc.text(`${vatAmount.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 12;
    doc.font('Helvetica-Bold');
    doc.text(`${t.subtotal} (${t.rental})`, 60, y);
    doc.text(`${rentalAmountTTC.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 12;
    doc.font('Helvetica');
    doc.text(t.deposit, 60, y);
    doc.text(`${deposit.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    y += 14;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(t.total, 60, y);
    doc.text(`${total.toFixed(2)} EUR`, 480, y, { align: 'right' });
    
    // ===== MODE DE PAIEMENT =====
    y += 25;
    doc.font('Helvetica-Bold').fontSize(9).text(t.payment, 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(8);
    
    const paymentMethods = { card: t.card, cash: t.cash, bizum: t.bizum, preauth: t.preauth };
    const rentalMethod = rental.payment_method ? (paymentMethods[rental.payment_method] || rental.payment_method) : '-';
    const depositMethod = rental.deposit_method ? (paymentMethods[rental.deposit_method] || rental.deposit_method) : '-';
    
    doc.text(`${t.rentalPayment}: ${rentalMethod}`, 50, y);
    doc.text(`${t.depositPayment}: ${depositMethod}`, 250, y);
    
    // ===== CONDITIONS GENERALES =====
    y += 20;
    doc.font('Helvetica-Bold').fontSize(9).text(t.conditions, 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(6.5).fillColor('#555');
    cond.forEach(c => { 
      doc.text(c, 50, y, { width: 495 }); 
      y += 9; 
    });
    
    // ===== SIGNATURES =====
    y += 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(t.signatures, 50, y);
    y += 10;
    
    // Zone signature client
    doc.rect(50, y, 200, 60).strokeColor('#ccc').stroke();
    
    // Ajouter la signature du client si elle existe
    if (rental.signature_customer) {
      try {
        // La signature est stockée en base64
        const signatureData = rental.signature_customer;
        if (signatureData.startsWith('data:image')) {
          const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
          const signatureBuffer = Buffer.from(base64Data, 'base64');
          doc.image(signatureBuffer, 55, y + 5, { width: 190, height: 50, fit: [190, 50] });
        }
      } catch (e) {
        console.error('Erreur chargement signature:', e.message);
      }
    }
    
    // Zone signature entreprise
    doc.rect(335, y, 160, 60).strokeColor('#ccc').stroke();
    
    doc.font('Helvetica').fontSize(7).fillColor('#666');
    doc.text(t.customerSignature, 55, y + 62);
    doc.text(`${rental.first_name} ${rental.last_name}`, 55, y + 71);
    doc.text(t.companySignature, 340, y + 62);
    
    // ===== PIED DE PAGE =====
    doc.fontSize(6).fillColor('#999');
    const locale = lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'es-ES';
    doc.text(`${t.generated} ${new Date().toLocaleDateString(locale)} - Voltride - Just Rent and Ride`, 50, 810, { align: 'center', width: 495 });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando contrato:', error);
    res.status(500).json({ error: 'Error generando el contrato' });
  }
});

module.exports = router;
