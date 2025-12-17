// =====================================================
// VOLTRIDE - Service d'envoi d'emails (Resend)
// =====================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

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
    
    // Ajouter les pièces jointes si présentes
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
        c.preferred_language,
        v.code as vehicle_code, v.type as vehicle_type, v.brand, v.model,
        a.name as agency_name, a.address as agency_address, a.phone as agency_phone
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) return null;
    
    const rental = result.rows[0];
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer.toString('base64'));
      });
      doc.on('error', reject);
      
      // Générer le contenu du PDF
      doc.fontSize(24).fillColor('#f59e0b').text('⚡ VOLTRIDE', 50, 50);
      doc.fontSize(10).fillColor('#666')
         .text(rental.agency_name || 'Voltride', 50, 80)
         .text(rental.agency_address || '', 50, 95);
      
      doc.fontSize(20).fillColor('#333').text('CONTRATO DE ALQUILER', 300, 50, { align: 'right' });
      doc.fontSize(11).fillColor('#666')
         .text(`Nº: ${rental.contract_number}`, 300, 80, { align: 'right' })
         .text(`Fecha: ${new Date(rental.start_date).toLocaleDateString('es-ES')}`, 300, 95, { align: 'right' });
      
      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#ddd').stroke();
      
      let y = 150;
      doc.fontSize(12).fillColor('#f59e0b').text('CLIENTE', 50, y);
      y += 20;
      doc.fontSize(11).fillColor('#333')
         .text(`${rental.first_name} ${rental.last_name}`, 50, y);
      y += 15;
      if (rental.id_number) {
        doc.text(`${rental.id_type?.toUpperCase() || 'ID'}: ${rental.id_number}`, 50, y);
        y += 15;
      }
      if (rental.email) doc.text(rental.email, 50, y);
      y += 15;
      if (rental.phone) doc.text(rental.phone, 50, y);
      
      y += 30;
      doc.fontSize(12).fillColor('#f59e0b').text('VEHÍCULO', 50, y);
      y += 20;
      const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
      doc.fontSize(11).fillColor('#333')
         .text(`${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, 50, y);
      
      y += 30;
      doc.fontSize(12).fillColor('#f59e0b').text('PERÍODO', 50, y);
      y += 20;
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      doc.fontSize(11).fillColor('#333')
         .text(`Inicio: ${startDate.toLocaleDateString('es-ES')} ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 15;
      doc.text(`Fin: ${endDate.toLocaleDateString('es-ES')} ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 15;
      doc.text(`Duración: ${days} día(s)`, 50, y);
      
      y += 30;
      doc.fontSize(12).fillColor('#f59e0b').text('TARIFAS', 50, y);
      y += 20;
      const totalAmount = parseFloat(rental.total_amount) || 0;
      const deposit = parseFloat(rental.deposit) || 0;
      doc.fontSize(11).fillColor('#333')
         .text(`Alquiler: ${totalAmount.toFixed(2)} €`, 50, y);
      y += 15;
      doc.text(`Depósito: ${deposit.toFixed(2)} €`, 50, y);
      y += 15;
      doc.fontSize(12).fillColor('#f59e0b').text(`TOTAL: ${(totalAmount + deposit).toFixed(2)} €`, 50, y);
      
      y += 40;
      doc.fontSize(10).fillColor('#666')
         .text('El cliente declara haber recibido el vehículo en perfecto estado y se compromete a devolverlo en las mismas condiciones.', 50, y, { width: 500 });
      
      y = 650;
      doc.fontSize(12).fillColor('#333').text('Firma del cliente:', 50, y);
      doc.rect(50, y + 20, 200, 60).stroke();
      
      doc.fontSize(9).fillColor('#999').text('Voltride - NIF: B12345678 | info@voltride.es', 50, 770, { align: 'center' });
      
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
        a.name as agency_name, a.address as agency_address
      FROM rentals r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.id = $1
    `, [rentalId]);
    
    if (result.rows.length === 0) return null;
    
    const rental = result.rows[0];
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer.toString('base64'));
      });
      doc.on('error', reject);
      
      // En-tête
      doc.fontSize(24).fillColor('#f59e0b').text('⚡ VOLTRIDE', 50, 50);
      doc.fontSize(10).fillColor('#666').text(rental.agency_name || 'Voltride', 50, 80);
      
      doc.fontSize(28).fillColor('#333').text('FACTURA', 350, 50, { align: 'right' });
      doc.fontSize(11).fillColor('#666')
         .text(`Nº: F-${rental.contract_number}`, 350, 85, { align: 'right' })
         .text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 350, 100, { align: 'right' });
      
      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#ddd').stroke();
      
      // Client
      let y = 150;
      doc.fontSize(12).fillColor('#f59e0b').text('CLIENTE', 50, y);
      y += 20;
      doc.fontSize(11).fillColor('#333').text(`${rental.first_name} ${rental.last_name}`, 50, y);
      if (rental.id_number) {
        y += 15;
        doc.text(`${rental.id_type?.toUpperCase()}: ${rental.id_number}`, 50, y);
      }
      
      // Détails
      y += 40;
      doc.fontSize(12).fillColor('#f59e0b').text('DETALLE', 50, y);
      y += 25;
      
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.end_date || rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const totalTTC = parseFloat(rental.total_amount) || 0;
      const totalHT = totalTTC / 1.21;
      const tva = totalTTC - totalHT;
      
      const vehicleIcon = rental.vehicle_type === 'bike' ? '🚲' : rental.vehicle_type === 'ebike' ? '⚡' : '🛵';
      doc.fontSize(11).fillColor('#333')
         .text(`${vehicleIcon} ${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, 50, y)
         .text(`${totalTTC.toFixed(2)} €`, 450, y);
      y += 15;
      doc.fontSize(10).fillColor('#666').text(`${days} día(s) x ${parseFloat(rental.daily_rate).toFixed(2)} €/día`, 50, y);
      
      // Totaux
      y += 40;
      doc.moveTo(300, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 15;
      doc.fontSize(10).fillColor('#666').text('Base imponible', 300, y);
      doc.fillColor('#333').text(`${totalHT.toFixed(2)} €`, 450, y);
      y += 18;
      doc.fillColor('#666').text('IVA 21%', 300, y);
      doc.fillColor('#333').text(`${tva.toFixed(2)} €`, 450, y);
      y += 25;
      
      doc.rect(290, y - 5, 260, 35).fillColor('#f59e0b').fill();
      doc.fontSize(12).fillColor('#fff').text('TOTAL', 300, y + 5);
      doc.fontSize(14).text(`${totalTTC.toFixed(2)} €`, 450, y + 3);
      
      // Dépôt info
      const deposit = parseFloat(rental.deposit) || 0;
      const deductions = parseFloat(rental.checkout_deductions) || 0;
      const refund = parseFloat(rental.checkout_refund) || (deposit - deductions);
      
      y += 60;
      doc.fontSize(11).fillColor('#333')
         .text(`Depósito pagado: ${deposit.toFixed(2)} €`, 300, y);
      y += 15;
      if (deductions > 0) {
        doc.fillColor('#e74c3c').text(`Deducciones: -${deductions.toFixed(2)} €`, 300, y);
        y += 15;
      }
      doc.fillColor('#27ae60').text(`Depósito devuelto: ${refund.toFixed(2)} €`, 300, y);
      
      // Pied de page
      doc.fontSize(12).fillColor('#27ae60').text('¡Gracias por confiar en Voltride!', 50, 700, { align: 'center' });
      doc.fontSize(9).fillColor('#999').text('Voltride - NIF: B12345678 | info@voltride.es', 50, 750, { align: 'center' });
      
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
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
            .highlight { color: #f59e0b; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ VOLTRIDE</h1>
              <p>Tu contrato de alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>Gracias por confiar en Voltride. Aquí tienes los detalles de tu alquiler:</p>
              
              <div class="info-box">
                <h3>📋 Contrato: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehículo:</strong> ${data.vehicle}</p>
                <p><strong>Inicio:</strong> ${data.start_date}</p>
                <p><strong>Fin previsto:</strong> ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.total} €</p>
                <p><strong>Depósito:</strong> ${data.deposit} €</p>
              </div>
              
              <p>📎 Encontrarás el contrato completo en el archivo adjunto.</p>
              
              <div class="info-box">
                <h3>📞 Contacto</h3>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>¡Disfruta de tu paseo! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
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
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
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
              <p>Merci de votre confiance. Voici les détails de votre location :</p>
              
              <div class="info-box">
                <h3>📋 Contrat : <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Véhicule :</strong> ${data.vehicle}</p>
                <p><strong>Début :</strong> ${data.start_date}</p>
                <p><strong>Fin prévue :</strong> ${data.end_date}</p>
                <p><strong>Total :</strong> ${data.total} €</p>
                <p><strong>Caution :</strong> ${data.deposit} €</p>
              </div>
              
              <p>📎 Vous trouverez le contrat complet en pièce jointe.</p>
              
              <div class="info-box">
                <h3>📞 Contact</h3>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>Bonne balade ! 🚲</p>
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
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
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
              <p>Thank you for choosing Voltride. Here are your rental details:</p>
              
              <div class="info-box">
                <h3>📋 Contract: <span class="highlight">${data.contract_number}</span></h3>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Start:</strong> ${data.start_date}</p>
                <p><strong>Expected end:</strong> ${data.end_date}</p>
                <p><strong>Total:</strong> ${data.total} €</p>
                <p><strong>Deposit:</strong> ${data.deposit} €</p>
              </div>
              
              <p>📎 You will find the complete contract attached.</p>
              
              <div class="info-box">
                <h3>📞 Contact</h3>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>Enjoy your ride! 🚲</p>
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
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #10b981; text-align: center; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
            .highlight { color: #10b981; font-weight: bold; }
            .amount { font-size: 28px; color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ VOLTRIDE</h1>
              <p>Factura y resumen</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>Gracias por haber elegido Voltride. Aquí tienes el resumen:</p>
              
              <div class="info-box">
                <h3>📋 Contrato: ${data.contract_number}</h3>
                <p><strong>Vehículo:</strong> ${data.vehicle}</p>
                <p><strong>Período:</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Duración:</strong> ${data.days} día(s)</p>
              </div>
              
              <div class="info-box">
                <h3>🧾 Factura: <span class="highlight">${data.invoice_number}</span></h3>
                <p><strong>Alquiler:</strong> ${data.rental_amount} €</p>
                ${data.deductions > 0 ? `<p><strong>Deducciones:</strong> -${data.deductions} €</p>` : ''}
                <p><strong>Depósito pagado:</strong> ${data.deposit_paid} €</p>
              </div>
              
              <div class="refund-box">
                <p>💰 Depósito devuelto:</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 Encontrarás la factura en el archivo adjunto.</p>
              
              <p>¡Esperamos verte pronto! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride</p>
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
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #10b981; text-align: center; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
            .highlight { color: #10b981; font-weight: bold; }
            .amount { font-size: 28px; color: #10b981; font-weight: bold; }
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
              <p>Merci d'avoir choisi Voltride. Voici le résumé :</p>
              
              <div class="info-box">
                <h3>📋 Contrat : ${data.contract_number}</h3>
                <p><strong>Véhicule :</strong> ${data.vehicle}</p>
                <p><strong>Période :</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Durée :</strong> ${data.days} jour(s)</p>
              </div>
              
              <div class="info-box">
                <h3>🧾 Facture : <span class="highlight">${data.invoice_number}</span></h3>
                <p><strong>Location :</strong> ${data.rental_amount} €</p>
                ${data.deductions > 0 ? `<p><strong>Déductions :</strong> -${data.deductions} €</p>` : ''}
                <p><strong>Caution payée :</strong> ${data.deposit_paid} €</p>
              </div>
              
              <div class="refund-box">
                <p>💰 Caution remboursée :</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 Vous trouverez la facture en pièce jointe.</p>
              
              <p>À bientôt ! 🚲</p>
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
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
            .refund-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #10b981; text-align: center; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            h1 { margin: 0; }
            .highlight { color: #10b981; font-weight: bold; }
            .amount { font-size: 28px; color: #10b981; font-weight: bold; }
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
              <p>Thank you for choosing Voltride. Here is your summary:</p>
              
              <div class="info-box">
                <h3>📋 Contract: ${data.contract_number}</h3>
                <p><strong>Vehicle:</strong> ${data.vehicle}</p>
                <p><strong>Period:</strong> ${data.start_date} → ${data.end_date}</p>
                <p><strong>Duration:</strong> ${data.days} day(s)</p>
              </div>
              
              <div class="info-box">
                <h3>🧾 Invoice: <span class="highlight">${data.invoice_number}</span></h3>
                <p><strong>Rental:</strong> ${data.rental_amount} €</p>
                ${data.deductions > 0 ? `<p><strong>Deductions:</strong> -${data.deductions} €</p>` : ''}
                <p><strong>Deposit paid:</strong> ${data.deposit_paid} €</p>
              </div>
              
              <div class="refund-box">
                <p>💰 Deposit refunded:</p>
                <p class="amount">${data.deposit_refunded} €</p>
              </div>
              
              <p>📎 You will find the invoice attached.</p>
              
              <p>See you soon! 🚲</p>
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
  getInvoiceEmailTemplate
};
