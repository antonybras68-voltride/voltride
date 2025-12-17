// =====================================================
// VOLTRIDE - Service Email & PDF (v5.0)
// Contrat et Facture unifiés
// =====================================================

const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

// Charger le logo en base64
function getLogoBase64() {
  try {
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return logoBuffer.toString('base64');
    }
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  return null;
}

// Envoyer un email
async function sendEmail({ to, subject, html, attachments = [] }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY non configuree - Email non envoye');
    return { success: false, error: 'API key not configured' };
  }
  
  try {
    const emailData = {
      from: EMAIL_FROM,
      to: to,
      subject: subject,
      html: html
    };
    
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments;
    }
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify(emailData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`Email envoye a ${to}`);
      return { success: true, id: result.id };
    } else {
      console.error('Erreur envoi email:', result);
      return { success: false, error: result.message || 'Unknown error' };
    }
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return { success: false, error: error.message };
  }
}

// Générer le PDF du contrat en base64 (identique à contracts.js)
async function generateContractPDF(rentalId, pool) {
  const PDFDocument = require('pdfkit');
  
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
    
    if (result.rows.length === 0) return null;
    
    const rental = result.rows[0];
    const logoBase64 = getLogoBase64();
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer.toString('base64'));
      });
      doc.on('error', reject);
      
      // === EN-TÊTE AVEC LOGO ===
      if (logoBase64) {
        try {
          const logoBuffer = Buffer.from(logoBase64, 'base64');
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
    });
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    return null;
  }
}

// Générer le PDF de la facture en base64
async function generateInvoicePDF(rentalId, pool) {
  const PDFDocument = require('pdfkit');
  
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.address, c.id_number, c.id_type,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone, a.email as agency_email
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) return null;
    
    const rental = result.rows[0];
    const logoBase64 = getLogoBase64();
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer.toString('base64'));
      });
      doc.on('error', reject);
      
      // === EN-TÊTE AVEC LOGO ===
      if (logoBase64) {
        try {
          const logoBuffer = Buffer.from(logoBase64, 'base64');
          doc.image(logoBuffer, 50, 30, { width: 100 });
        } catch (e) {
          doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
        }
      } else {
        doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 40);
      }
      
      // Infos agence
      doc.fontSize(9).fillColor('#666')
         .text(rental.agency_name || 'Voltride', 50, 85)
         .text(rental.agency_address || '', 50, 97)
         .text(rental.agency_phone || '', 50, 109);
      
      // Titre FACTURA
      doc.fontSize(28).fillColor('#10b981').text('FACTURA', 400, 40, { width: 145, align: 'right' });
      doc.fontSize(10).fillColor('#666')
         .text(`N.: F-${rental.contract_number}`, 400, 75, { width: 145, align: 'right' })
         .text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 400, 90, { width: 145, align: 'right' });
      
      // Ligne séparatrice
      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#10b981').lineWidth(2).stroke();
      
      // === CLIENT ===
      let y = 150;
      doc.fontSize(11).fillColor('#10b981').text('CLIENTE', 50, y);
      y += 18;
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
      doc.fontSize(11).fillColor('#10b981').text('DETALLE DEL ALQUILER', 50, y);
      y += 25;
      
      const colDesc = 60;
      const colQty = 320;
      const colPrice = 400;
      const colTotal = 480;
      
      // En-tête tableau
      doc.rect(50, y - 5, 495, 22).fillColor('#f0fdf4').fill();
      doc.fontSize(9).fillColor('#666')
         .text('Descripcion', colDesc, y)
         .text('Cantidad', colQty, y)
         .text('Precio', colPrice, y)
         .text('Total', colTotal, y);
      y += 28;
      
      // Calculs
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.end_date || rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const dailyRate = parseFloat(rental.daily_rate) || 0;
      const rentalTotal = parseFloat(rental.total_amount) || (days * dailyRate);
      
      // Ligne véhicule
      doc.fontSize(10).fillColor('#333')
         .text(`${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, colDesc, y)
         .text(`${days} dia(s)`, colQty, y)
         .text(`${dailyRate.toFixed(2)} EUR`, colPrice, y)
         .text(`${rentalTotal.toFixed(2)} EUR`, colTotal, y);
      y += 20;
      
      // Accessoires
      if (rental.notes && rental.notes.includes('Accesorios:')) {
        const accStr = rental.notes.replace('Accesorios:', '').trim();
        const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
        doc.fontSize(9).fillColor('#666');
        accessories.forEach(acc => {
          doc.text(`  - ${acc}`, colDesc, y);
          doc.text('Incluido', colTotal, y);
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
        doc.fontSize(10).fillColor('#e74c3c').text('DEDUCCIONES:', 50, y);
        y += 18;
        
        if (rental.checkout_notes) {
          const deductionsList = rental.checkout_notes.split(',').map(d => d.trim());
          doc.fontSize(9).fillColor('#666');
          deductionsList.forEach(ded => {
            doc.text(`  - ${ded}`, 60, y);
            y += 14;
          });
        }
        y += 8;
      }
      
      // === TOTAUX ===
      const labelX = 350;
      const valueX = 480;
      
      const deposit = parseFloat(rental.deposit) || 0;
      const depositRefund = parseFloat(rental.checkout_refund) || (deposit - deductions);
      const rentalHT = rentalTotal / 1.21;
      const tva = rentalTotal - rentalHT;
      
      doc.moveTo(labelX - 20, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 15;
      
      doc.fontSize(10).fillColor('#666').text('Base imponible:', labelX, y);
      doc.fillColor('#333').text(`${rentalHT.toFixed(2)} EUR`, valueX, y);
      y += 20;
      
      doc.fillColor('#666').text('IVA 21%:', labelX, y);
      doc.fillColor('#333').text(`${tva.toFixed(2)} EUR`, valueX, y);
      y += 25;
      
      // Total TTC
      doc.rect(labelX - 20, y - 5, 215, 28).fillColor('#10b981').fill();
      doc.fontSize(12).fillColor('#fff')
         .text('TOTAL:', labelX - 10, y + 3)
         .text(`${rentalTotal.toFixed(2)} EUR`, valueX, y + 3);
      y += 45;
      
      // Dépôt
      doc.fontSize(10).fillColor('#333');
      doc.text('Deposito pagado:', labelX, y);
      doc.text(`${deposit.toFixed(2)} EUR`, valueX, y);
      y += 20;
      
      if (deductions > 0) {
        doc.fillColor('#e74c3c').text('Deducciones:', labelX, y);
        doc.text(`-${deductions.toFixed(2)} EUR`, valueX, y);
        y += 20;
      }
      
      // Dépôt remboursé
      doc.rect(labelX - 20, y - 5, 215, 28).fillColor('#ecfdf5').fill();
      doc.rect(labelX - 20, y - 5, 215, 28).strokeColor('#10b981').stroke();
      doc.fontSize(10).fillColor('#10b981').text('Deposito devuelto:', labelX - 10, y + 3);
      doc.fontSize(12).text(`${depositRefund.toFixed(2)} EUR`, valueX, y + 3);
      
      // === PIED DE PAGE ===
      doc.fontSize(12).fillColor('#10b981').text('Gracias por confiar en Voltride!', 50, 700, { align: 'center', width: 495 });
      
      doc.fontSize(8).fillColor('#999')
         .text(`Voltride - ${rental.agency_name || ''} | ${rental.agency_email || 'info@voltride.es'} | ${rental.agency_phone || ''}`, 50, 750, { align: 'center', width: 495 });
      
      doc.end();
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return null;
  }
}

// Template email contrat
function getContractEmailTemplate(data, lang = 'es') {
  const templates = {
    es: {
      subject: `Tu contrato de alquiler Voltride - ${data.contract_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; font-size: 24px; }
            h3 { margin: 0 0 15px 0; color: #f59e0b; }
            .highlight { color: #f59e0b; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Tu contrato de alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>Gracias por elegir Voltride. Aqui tienes los detalles de tu alquiler:</p>
              
              <div class="info-box">
                <h3>Contrato: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehiculo:</strong> ${data.vehicle}</p>
                <p><strong>Inicio:</strong> ${data.start_date}</p>
                <p><strong>Fin previsto:</strong> ${data.end_date}</p>
              </div>
              
              ${data.accessories ? `
              <div class="info-box">
                <h3>Accesorios incluidos</h3>
                <p>${data.accessories}</p>
              </div>
              ` : ''}
              
              <div class="info-box">
                <h3>Resumen economico</h3>
                <p><strong>Total alquiler:</strong> ${data.total} EUR</p>
                <p><strong>Deposito:</strong> ${data.deposit} EUR</p>
                <p style="font-size: 18px; color: #f59e0b; margin-top: 15px;"><strong>Total pagado: ${(parseFloat(data.total) + parseFloat(data.deposit)).toFixed(2)} EUR</strong></p>
              </div>
              
              <p>Encontraras el contrato completo en el archivo PDF adjunto.</p>
              
              <div class="info-box">
                <h3>Necesitas ayuda?</h3>
                <p>Tel: ${data.agency_phone || '+34 635 992 987'}</p>
                <p>Email: ${data.agency_email || 'info@voltride.es'}</p>
              </div>
              
              <p style="text-align: center; font-size: 18px;">Disfruta de tu paseo!</p>
            </div>
            <div class="footer">
              <p>Voltride - Alquiler de bicicletas y vehiculos electricos</p>
              <p>NIE: Z0320770V</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    fr: {
      subject: `Votre contrat de location Voltride - ${data.contract_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; }
            h3 { color: #f59e0b; margin: 0 0 15px 0; }
            .highlight { color: #f59e0b; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p>Votre contrat de location</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${data.customer_name}</strong>,</p>
              <p>Merci d'avoir choisi Voltride. Voici les details de votre location :</p>
              
              <div class="info-box">
                <h3>Contrat : <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehicule :</strong> ${data.vehicle}</p>
                <p><strong>Debut :</strong> ${data.start_date}</p>
                <p><strong>Fin prevue :</strong> ${data.end_date}</p>
                <p><strong>Total :</strong> ${data.total} EUR</p>
                <p><strong>Caution :</strong> ${data.deposit} EUR</p>
              </div>
              
              <p>Vous trouverez le contrat complet en piece jointe.</p>
              <p style="text-align: center; font-size: 18px;">Bonne balade !</p>
            </div>
            <div class="footer">
              <p>Voltride - Location de velos et vehicules electriques</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    en: {
      subject: `Your Voltride rental contract - ${data.contract_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; }
            h3 { color: #f59e0b; margin: 0 0 15px 0; }
            .highlight { color: #f59e0b; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p>Your rental contract</p>
            </div>
            <div class="content">
              <p>Hello <strong>${data.customer_name}</strong>,</p>
              <p>Thank you for choosing Voltride. Here are your rental details:</p>
              
              <div class="info-box">
                <h3>Contract: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Start:</strong> ${data.start_date}</p>
                <p><strong>Expected end:</strong> ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.total} EUR</p>
                <p><strong>Deposit:</strong> ${data.deposit} EUR</p>
              </div>
              
              <p>You will find the complete contract attached.</p>
              <p style="text-align: center; font-size: 18px;">Enjoy your ride!</p>
            </div>
            <div class="footer">
              <p>Voltride - Bike and electric vehicle rental</p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };
  
  return templates[lang] || templates.es;
}

// Template email facture
function getInvoiceEmailTemplate(data, lang = 'es') {
  const templates = {
    es: {
      subject: `Tu factura Voltride - ${data.invoice_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #10b981; text-align: center; }
            .deductions-box { background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; }
            h3 { color: #10b981; margin: 0 0 15px 0; }
            .highlight { color: #10b981; font-weight: bold; }
            .amount { font-size: 32px; color: #10b981; font-weight: bold; }
            .warning { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p>Factura y resumen de tu alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>Gracias por haber elegido Voltride. Aqui tienes el resumen:</p>
              
              <div class="info-box">
                <h3>Resumen del alquiler</h3>
                <p><strong>Contrato:</strong> ${data.contract_number}</p>
                <p><strong>Vehiculo:</strong> ${data.vehicle}</p>
                <p><strong>Periodo:</strong> ${data.start_date} - ${data.end_date}</p>
                <p><strong>Duracion:</strong> ${data.days} dia(s)</p>
              </div>
              
              <div class="info-box">
                <h3>Factura: <span class="highlight">${data.invoice_number}</span></h3>
                <p><strong>Total alquiler:</strong> ${data.rental_amount} EUR</p>
                <p><strong>Deposito pagado:</strong> ${data.deposit_paid} EUR</p>
              </div>
              
              ${parseFloat(data.deductions) > 0 ? `
              <div class="deductions-box">
                <h3 class="warning">Deducciones aplicadas</h3>
                <p><strong>Total deducciones:</strong> <span class="warning">-${data.deductions} EUR</span></p>
                <p style="font-size: 12px; color: #666;">Ver detalle en la factura adjunta</p>
              </div>
              ` : ''}
              
              <div class="refund-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Deposito devuelto:</p>
                <p class="amount">${data.deposit_refunded} EUR</p>
              </div>
              
              <p>Encontraras la factura detallada en el archivo PDF adjunto.</p>
              
              <p style="text-align: center; font-size: 18px; margin-top: 30px;">Esperamos verte pronto!</p>
            </div>
            <div class="footer">
              <p>Voltride - Alquiler de bicicletas y vehiculos electricos</p>
              <p>NIE: Z0320770V</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    fr: {
      subject: `Votre facture Voltride - ${data.invoice_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #10b981; text-align: center; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; }
            .amount { font-size: 32px; color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p>Facture et resume</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${data.customer_name}</strong>,</p>
              <p>Merci d'avoir choisi Voltride !</p>
              
              <div class="info-box">
                <p><strong>Contrat :</strong> ${data.contract_number}</p>
                <p><strong>Vehicule :</strong> ${data.vehicle}</p>
                <p><strong>Periode :</strong> ${data.start_date} - ${data.end_date}</p>
                <p><strong>Total :</strong> ${data.rental_amount} EUR</p>
              </div>
              
              <div class="refund-box">
                <p>Caution remboursee :</p>
                <p class="amount">${data.deposit_refunded} EUR</p>
              </div>
              
              <p>Facture en piece jointe.</p>
              <p style="text-align: center;">A bientot !</p>
            </div>
            <div class="footer">
              <p>Voltride - Location de velos et vehicules electriques</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    en: {
      subject: `Your Voltride invoice - ${data.invoice_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #10b981; text-align: center; }
            .footer { text-align: center; padding: 20px; background: #333; color: #999; font-size: 12px; }
            h1 { margin: 0; }
            .amount { font-size: 32px; color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VOLTRIDE</h1>
              <p>Invoice and summary</p>
            </div>
            <div class="content">
              <p>Hello <strong>${data.customer_name}</strong>,</p>
              <p>Thank you for choosing Voltride!</p>
              
              <div class="info-box">
                <p><strong>Contract:</strong> ${data.contract_number}</p>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Period:</strong> ${data.start_date} - ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.rental_amount} EUR</p>
              </div>
              
              <div class="refund-box">
                <p>Deposit refunded:</p>
                <p class="amount">${data.deposit_refunded} EUR</p>
              </div>
              
              <p>Invoice attached.</p>
              <p style="text-align: center;">See you soon!</p>
            </div>
            <div class="footer">
              <p>Voltride - Bike and electric vehicle rental</p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };
  
  return templates[lang] || templates.es;
}

module.exports = {
  sendEmail,
  generateContractPDF,
  generateInvoicePDF,
  getContractEmailTemplate,
  getInvoiceEmailTemplate,
  getLogoBase64
};
