// =====================================================
// VOLTRIDE - Service Email & PDF (v3.0)
// Avec logo, accessoires, déductions, photo ticket
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
    console.warn('⚠️ RESEND_API_KEY non configurée - Email non envoyé');
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
      console.log(`✅ Email envoyé à ${to}`);
      return { success: true, id: result.id };
    } else {
      console.error('❌ Erreur envoi email:', result);
      return { success: false, error: result.message || 'Unknown error' };
    }
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return { success: false, error: error.message };
  }
}

// Générer le PDF du contrat en base64
async function generateContractPDF(rentalId, pool) {
  const PDFDocument = require('pdfkit');
  
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        c.first_name, c.last_name, c.email, c.phone, c.address, c.id_number, c.id_type,
        c.preferred_language, c.country,
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
      
      // Titre et numéro de contrat
      doc.fontSize(22).fillColor('#333').text('CONTRATO DE ALQUILER', 300, 50, { align: 'right' });
      doc.fontSize(11).fillColor('#666')
         .text(`Nº: ${rental.contract_number}`, 300, 80, { align: 'right' })
         .text(`Fecha: ${new Date(rental.start_date).toLocaleDateString('es-ES')}`, 300, 95, { align: 'right' });
      
      // Ligne séparatrice
      doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#f59e0b').lineWidth(2).stroke();
      
      // === SECTION CLIENT ===
      let y = 165;
      doc.fontSize(12).fillColor('#f59e0b').text('DATOS DEL CLIENTE', 50, y);
      y += 20;
      
      doc.fontSize(10).fillColor('#333');
      doc.text(`Nombre: ${rental.first_name} ${rental.last_name}`, 50, y);
      y += 15;
      if (rental.id_number) {
        doc.text(`${(rental.id_type || 'ID').toUpperCase()}: ${rental.id_number}`, 50, y);
        y += 15;
      }
      if (rental.phone) {
        doc.text(`Teléfono: ${rental.phone}`, 50, y);
        y += 15;
      }
      if (rental.email) {
        doc.text(`Email: ${rental.email}`, 50, y);
        y += 15;
      }
      if (rental.country) {
        doc.text(`País: ${rental.country}`, 50, y);
        y += 15;
      }
      
      // === SECTION VÉHICULE ===
      y += 10;
      doc.fontSize(12).fillColor('#f59e0b').text('VEHÍCULO ALQUILADO', 50, y);
      y += 20;
      
      const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
      doc.fontSize(11).fillColor('#333')
         .text(`${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, 50, y);
      y += 15;
      doc.fontSize(10).text(`Tipo: ${rental.vehicle_type === 'bike' ? 'Bicicleta' : rental.vehicle_type === 'ebike' ? 'Bicicleta Eléctrica' : 'Scooter'}`, 50, y);
      
      // === ACCESSOIRES ===
      if (rental.notes && rental.notes.includes('Accesorios:')) {
        y += 25;
        doc.fontSize(12).fillColor('#f59e0b').text('ACCESORIOS INCLUIDOS', 50, y);
        y += 20;
        
        const accStr = rental.notes.replace('Accesorios:', '').trim();
        const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
        
        doc.fontSize(10).fillColor('#333');
        accessories.forEach(acc => {
          doc.text(`• ${acc}`, 60, y);
          y += 14;
        });
      }
      
      // === PÉRIODE ET TARIFS ===
      y += 15;
      doc.fontSize(12).fillColor('#f59e0b').text('PERÍODO Y TARIFAS', 50, y);
      y += 20;
      
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const totalAmount = parseFloat(rental.total_amount) || 0;
      const deposit = parseFloat(rental.deposit) || 0;
      
      doc.fontSize(10).fillColor('#333');
      doc.text(`Inicio: ${startDate.toLocaleDateString('es-ES')} ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 15;
      doc.text(`Fin previsto: ${endDate.toLocaleDateString('es-ES')} ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 15;
      doc.text(`Duración: ${days} día(s)`, 50, y);
      y += 20;
      
      // Tableau des tarifs
      doc.rect(50, y, 250, 80).fillColor('#f5f5f5').fill();
      doc.fillColor('#333');
      y += 10;
      doc.text(`Tarifa diaria: ${parseFloat(rental.daily_rate).toFixed(2)} €`, 60, y);
      y += 18;
      doc.text(`Total alquiler: ${totalAmount.toFixed(2)} €`, 60, y);
      y += 18;
      doc.text(`Depósito: ${deposit.toFixed(2)} €`, 60, y);
      y += 18;
      doc.fontSize(11).fillColor('#f59e0b').text(`TOTAL A PAGAR: ${(totalAmount + deposit).toFixed(2)} €`, 60, y);
      
      // === CONDITIONS ===
      y += 50;
      doc.fontSize(9).fillColor('#666')
         .text('CONDICIONES:', 50, y);
      y += 12;
      doc.text('• El cliente se compromete a devolver el vehículo en el mismo estado en que lo recibió.', 50, y, { width: 500 });
      y += 20;
      doc.text('• En caso de daños o pérdida, el cliente será responsable de los costes de reparación/reemplazo.', 50, y, { width: 500 });
      y += 20;
      doc.text('• El depósito será devuelto tras la inspección del vehículo al momento de la devolución.', 50, y, { width: 500 });
      
      // === SIGNATURES ===
      y = 680;
      doc.fontSize(10).fillColor('#333');
      doc.text('Firma del cliente:', 50, y);
      doc.rect(50, y + 15, 200, 50).stroke();
      
      doc.text('Firma de la agencia:', 320, y);
      doc.rect(320, y + 15, 200, 50).stroke();
      
      // Pied de page
      doc.fontSize(8).fillColor('#999')
         .text(`Voltride - ${rental.agency_name || ''} | ${rental.agency_email || 'info@voltride.es'} | ${rental.agency_phone || ''}`, 50, 780, { align: 'center' });
      
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
      doc.fontSize(11).fillColor('#666')
         .text(`Nº: F-${rental.contract_number}`, 350, 85, { align: 'right' })
         .text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 350, 100, { align: 'right' });
      
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
      
      // === DÉTAIL DE LA LOCATION ===
      y += 30;
      doc.fontSize(12).fillColor('#10b981').text('DETALLE DEL ALQUILER', 50, y);
      y += 25;
      
      // Tableau
      const col1 = 50, col2 = 280, col3 = 380, col4 = 480;
      
      // En-tête tableau
      doc.rect(50, y - 5, 495, 25).fillColor('#f0fdf4').fill();
      doc.fontSize(10).fillColor('#333')
         .text('Descripción', col1 + 10, y)
         .text('Cantidad', col2, y)
         .text('Precio', col3, y)
         .text('Total', col4, y);
      y += 30;
      
      // Calculs
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.end_date || rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const dailyRate = parseFloat(rental.daily_rate) || 0;
      const rentalTotal = parseFloat(rental.total_amount) || (days * dailyRate);
      
      // Ligne véhicule
      const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
      doc.fontSize(10).fillColor('#333')
         .text(`${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, col1, y)
         .text(`${days} día(s)`, col2, y)
         .text(`${dailyRate.toFixed(2)} €`, col3, y)
         .text(`${rentalTotal.toFixed(2)} €`, col4, y);
      y += 20;
      
      // Accessoires (si présents)
      if (rental.notes && rental.notes.includes('Accesorios:')) {
        const accStr = rental.notes.replace('Accesorios:', '').trim();
        const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
        accessories.forEach(acc => {
          doc.text(`   🎒 ${acc}`, col1, y).text('Incluido', col4, y);
          y += 15;
        });
      }
      
      // Ligne séparatrice
      y += 10;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 15;
      
      // === DÉDUCTIONS (si présentes) ===
      const deductions = parseFloat(rental.checkout_deductions) || 0;
      if (deductions > 0 && rental.checkout_notes) {
        doc.fontSize(11).fillColor('#e74c3c').text('DEDUCCIONES:', col1, y);
        y += 18;
        
        const deductionsList = rental.checkout_notes.split(',').map(d => d.trim());
        doc.fontSize(10);
        deductionsList.forEach(ded => {
          doc.text(`• ${ded}`, col1 + 10, y);
          y += 15;
        });
        
        doc.text(`Total deducciones:`, col3, y);
        doc.fillColor('#e74c3c').text(`-${deductions.toFixed(2)} €`, col4, y);
        y += 25;
      }
      
      // === TOTAUX ===
      const deposit = parseFloat(rental.deposit) || 0;
      const depositRefund = parseFloat(rental.checkout_refund) || (deposit - deductions);
      
      // Base HT et TVA
      const rentalHT = rentalTotal / 1.21;
      const tva = rentalTotal - rentalHT;
      
      doc.fontSize(10).fillColor('#666');
      doc.text('Base imponible:', col3, y);
      doc.fillColor('#333').text(`${rentalHT.toFixed(2)} €`, col4, y);
      y += 18;
      
      doc.fillColor('#666').text('IVA 21%:', col3, y);
      doc.fillColor('#333').text(`${tva.toFixed(2)} €`, col4, y);
      y += 25;
      
      // Total TTC
      doc.rect(col3 - 10, y - 5, 175, 30).fillColor('#10b981').fill();
      doc.fontSize(12).fillColor('#fff')
         .text('TOTAL:', col3, y + 3)
         .text(`${rentalTotal.toFixed(2)} €`, col4, y + 3);
      y += 45;
      
      // === DÉPÔT ===
      doc.fontSize(10).fillColor('#333');
      doc.text(`Depósito pagado:`, col3, y);
      doc.text(`${deposit.toFixed(2)} €`, col4, y);
      y += 18;
      
      if (deductions > 0) {
        doc.fillColor('#e74c3c').text(`Deducciones:`, col3, y);
        doc.text(`-${deductions.toFixed(2)} €`, col4, y);
        y += 18;
      }
      
      doc.fillColor('#10b981').text(`Depósito devuelto:`, col3, y);
      doc.fontSize(12).text(`${depositRefund.toFixed(2)} €`, col4, y);
      
      // === PIED DE PAGE ===
      doc.fontSize(14).fillColor('#10b981').text('¡Gracias por confiar en Voltride!', 50, 700, { align: 'center' });
      
      doc.fontSize(8).fillColor('#999')
         .text(`Voltride - ${rental.agency_name || ''} | ${rental.agency_email || 'info@voltride.es'} | ${rental.agency_phone || ''}`, 50, 750, { align: 'center' });
      
      doc.end();
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return null;
  }
}

// Template email contrat (Check-in)
function getContractEmailTemplate(data, lang = 'es') {
  const templates = {
    es: {
      subject: `🚲 Tu contrato de alquiler Voltride - ${data.contract_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; }
            .header img { max-height: 60px; margin-bottom: 10px; }
            .content { background: #f9f9f9; padding: 30px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #333; color: #999; }
            h1 { margin: 0; font-size: 24px; }
            h3 { margin: 0 0 15px 0; color: #f59e0b; }
            .highlight { color: #f59e0b; font-weight: bold; }
            .accessories { background: #fff8e1; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .accessories ul { margin: 10px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ VOLTRIDE</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Tu contrato de alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>¡Gracias por elegir Voltride! Aquí tienes los detalles de tu alquiler:</p>
              
              <div class="info-box">
                <h3>📋 Contrato: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehículo:</strong> ${data.vehicle}</p>
                <p><strong>Inicio:</strong> ${data.start_date}</p>
                <p><strong>Fin previsto:</strong> ${data.end_date}</p>
              </div>
              
              ${data.accessories ? `
              <div class="accessories">
                <h3>🎒 Accesorios incluidos</h3>
                <ul>
                  ${data.accessories.split(',').map(a => `<li>${a.trim()}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              
              <div class="info-box">
                <h3>💰 Resumen económico</h3>
                <p><strong>Total alquiler:</strong> ${data.total} €</p>
                <p><strong>Depósito:</strong> ${data.deposit} €</p>
                <p style="font-size: 18px; color: #f59e0b; margin-top: 15px;"><strong>Total pagado: ${(parseFloat(data.total) + parseFloat(data.deposit)).toFixed(2)} €</strong></p>
              </div>
              
              <p>📎 Encontrarás el contrato completo en el archivo PDF adjunto.</p>
              
              <div class="info-box">
                <h3>📞 ¿Necesitas ayuda?</h3>
                <p>📱 ${data.agency_phone || '+34 600 000 001'}</p>
                <p>📧 ${data.agency_email || 'info@voltride.es'}</p>
              </div>
              
              <p style="text-align: center; font-size: 18px;">¡Disfruta de tu paseo! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Alquiler de bicicletas y vehículos eléctricos</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    fr: {
      subject: `🚲 Votre contrat de location Voltride - ${data.contract_number}`,
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
              <h1>⚡ VOLTRIDE</h1>
              <p>Votre contrat de location</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${data.customer_name}</strong>,</p>
              <p>Merci d'avoir choisi Voltride ! Voici les détails de votre location :</p>
              
              <div class="info-box">
                <h3>📋 Contrat : <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Véhicule :</strong> ${data.vehicle}</p>
                <p><strong>Début :</strong> ${data.start_date}</p>
                <p><strong>Fin prévue :</strong> ${data.end_date}</p>
                <p><strong>Total :</strong> ${data.total} €</p>
                <p><strong>Caution :</strong> ${data.deposit} €</p>
              </div>
              
              <p>📎 Vous trouverez le contrat complet en pièce jointe.</p>
              
              <p style="text-align: center; font-size: 18px;">Bonne balade ! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    en: {
      subject: `🚲 Your Voltride rental contract - ${data.contract_number}`,
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
              <h1>⚡ VOLTRIDE</h1>
              <p>Your rental contract</p>
            </div>
            <div class="content">
              <p>Hello <strong>${data.customer_name}</strong>,</p>
              <p>Thank you for choosing Voltride! Here are your rental details:</p>
              
              <div class="info-box">
                <h3>📋 Contract: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Start:</strong> ${data.start_date}</p>
                <p><strong>Expected end:</strong> ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.total} €</p>
                <p><strong>Deposit:</strong> ${data.deposit} €</p>
              </div>
              
              <p>📎 You will find the complete contract attached.</p>
              
              <p style="text-align: center; font-size: 18px;">Enjoy your ride! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };
  
  return templates[lang] || templates.es;
}

// Template email facture (Check-out)
function getInvoiceEmailTemplate(data, lang = 'es') {
  const templates = {
    es: {
      subject: `🧾 Tu factura Voltride - ${data.invoice_number}`,
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
              <h1>⚡ VOLTRIDE</h1>
              <p>Factura y resumen de tu alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>¡Gracias por haber elegido Voltride! Aquí tienes el resumen de tu alquiler:</p>
              
              <div class="info-box">
                <h3>📋 Resumen del alquiler</h3>
                <p><strong>Contrato:</strong> ${data.contract_number}</p>
                <p><strong>Vehículo:</strong> ${data.vehicle}</p>
                <p><strong>Período:</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Duración:</strong> ${data.days} día(s)</p>
              </div>
              
              <div class="info-box">
                <h3>🧾 Factura: <span class="highlight">${data.invoice_number}</span></h3>
                <p><strong>Total alquiler:</strong> ${data.rental_amount} €</p>
                <p><strong>Depósito pagado:</strong> ${data.deposit_paid} €</p>
              </div>
              
              ${parseFloat(data.deductions) > 0 ? `
              <div class="deductions-box">
                <h3 class="warning">⚠️ Deducciones aplicadas</h3>
                <p><strong>Total deducciones:</strong> <span class="warning">-${data.deductions} €</span></p>
                <p style="font-size: 12px; color: #666;">Ver detalle en la factura adjunta</p>
              </div>
              ` : ''}
              
              <div class="refund-box">
                <p style="margin: 0; font-size: 14px; color: #666;">💰 Depósito devuelto:</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 Encontrarás la factura detallada en el archivo PDF adjunto.</p>
              
              <p style="text-align: center; font-size: 18px; margin-top: 30px;">¡Esperamos verte pronto! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Alquiler de bicicletas y vehículos eléctricos</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    fr: {
      subject: `🧾 Votre facture Voltride - ${data.invoice_number}`,
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
              <h1>⚡ VOLTRIDE</h1>
              <p>Facture et résumé</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${data.customer_name}</strong>,</p>
              <p>Merci d'avoir choisi Voltride !</p>
              
              <div class="info-box">
                <p><strong>Contrat :</strong> ${data.contract_number}</p>
                <p><strong>Véhicule :</strong> ${data.vehicle}</p>
                <p><strong>Période :</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Total :</strong> ${data.rental_amount} €</p>
              </div>
              
              <div class="refund-box">
                <p>💰 Caution remboursée :</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 Facture en pièce jointe.</p>
              <p style="text-align: center;">À bientôt ! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    en: {
      subject: `🧾 Your Voltride invoice - ${data.invoice_number}`,
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
              <h1>⚡ VOLTRIDE</h1>
              <p>Invoice and summary</p>
            </div>
            <div class="content">
              <p>Hello <strong>${data.customer_name}</strong>,</p>
              <p>Thank you for choosing Voltride!</p>
              
              <div class="info-box">
                <p><strong>Contract:</strong> ${data.contract_number}</p>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Period:</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.rental_amount} €</p>
              </div>
              
              <div class="refund-box">
                <p>💰 Deposit refunded:</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 Invoice attached.</p>
              <p style="text-align: center;">See you soon! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
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
