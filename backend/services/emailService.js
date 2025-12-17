// =====================================================
// VOLTRIDE - Service Email & PDF (v4.0)
// Sans emojis, mise en page corrigée
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
          doc.image(logoBuffer, 50, 40, { width: 100 });
        } catch (e) {
          doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
        }
      } else {
        doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
      }
      
      // Infos agence sous le logo
      doc.fontSize(9).fillColor('#666')
         .text(rental.agency_name || 'Voltride', 50, 95)
         .text(rental.agency_address || '', 50, 107)
         .text(rental.agency_phone || '', 50, 119);
      
      // Titre CONTRATO - position ajustée
      doc.fontSize(18).fillColor('#f59e0b').text('CONTRATO DE ALQUILER', 300, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#666')
         .text(`N.: ${rental.contract_number}`, 300, 75, { align: 'right' })
         .text(`Fecha: ${new Date(rental.start_date).toLocaleDateString('es-ES')}`, 300, 90, { align: 'right' });
      
      // Ligne séparatrice
      doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#f59e0b').lineWidth(2).stroke();
      
      // === SECTION CLIENT ===
      let y = 160;
      doc.fontSize(11).fillColor('#f59e0b').text('DATOS DEL CLIENTE', 50, y);
      y += 18;
      
      doc.fontSize(10).fillColor('#333');
      doc.text(`Nombre: ${rental.first_name} ${rental.last_name}`, 50, y);
      y += 14;
      if (rental.id_number) {
        doc.text(`${(rental.id_type || 'ID').toUpperCase()}: ${rental.id_number}`, 50, y);
        y += 14;
      }
      if (rental.phone) {
        doc.text(`Telefono: ${rental.phone}`, 50, y);
        y += 14;
      }
      if (rental.email) {
        doc.text(`Email: ${rental.email}`, 50, y);
        y += 14;
      }
      if (rental.country) {
        doc.text(`Pais: ${rental.country}`, 50, y);
        y += 14;
      }
      
      // === SECTION VÉHICULE ===
      y += 10;
      doc.fontSize(11).fillColor('#f59e0b').text('VEHICULO ALQUILADO', 50, y);
      y += 18;
      
      doc.fontSize(10).fillColor('#333')
         .text(`${rental.vehicle_code} - ${rental.brand || ''} ${rental.model || ''}`, 50, y);
      y += 14;
      
      const vehicleTypeName = rental.vehicle_type === 'bike' ? 'Bicicleta' : 
                              rental.vehicle_type === 'ebike' ? 'Bicicleta Electrica' : 'Scooter';
      doc.text(`Tipo: ${vehicleTypeName}`, 50, y);
      
      // === ACCESSOIRES ===
      if (rental.notes && rental.notes.includes('Accesorios:')) {
        y += 20;
        doc.fontSize(11).fillColor('#f59e0b').text('ACCESORIOS INCLUIDOS', 50, y);
        y += 18;
        
        const accStr = rental.notes.replace('Accesorios:', '').trim();
        const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
        
        doc.fontSize(10).fillColor('#333');
        accessories.forEach(acc => {
          doc.text(`- ${acc}`, 60, y);
          y += 13;
        });
      }
      
      // === PÉRIODE ET TARIFS ===
      y += 15;
      doc.fontSize(11).fillColor('#f59e0b').text('PERIODO Y TARIFAS', 50, y);
      y += 18;
      
      const startDate = new Date(rental.start_date);
      const endDate = new Date(rental.planned_end_date);
      const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const totalAmount = parseFloat(rental.total_amount) || 0;
      const deposit = parseFloat(rental.deposit) || 0;
      
      doc.fontSize(10).fillColor('#333');
      doc.text(`Inicio: ${startDate.toLocaleDateString('es-ES')} ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 14;
      doc.text(`Fin previsto: ${endDate.toLocaleDateString('es-ES')} ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, y);
      y += 14;
      doc.text(`Duracion: ${days} dia(s)`, 50, y);
      y += 20;
      
      // Tableau des tarifs
      doc.rect(50, y, 220, 75).fillColor('#f9f9f9').fill();
      doc.rect(50, y, 220, 75).strokeColor('#ddd').stroke();
      y += 12;
      doc.fillColor('#333');
      doc.text(`Tarifa diaria: ${parseFloat(rental.daily_rate).toFixed(2)} EUR`, 60, y);
      y += 16;
      doc.text(`Total alquiler: ${totalAmount.toFixed(2)} EUR`, 60, y);
      y += 16;
      doc.text(`Deposito: ${deposit.toFixed(2)} EUR`, 60, y);
      y += 18;
      doc.fontSize(11).fillColor('#f59e0b').text(`TOTAL A PAGAR: ${(totalAmount + deposit).toFixed(2)} EUR`, 60, y);
      
      // === CONDITIONS ===
      y += 45;
      doc.fontSize(9).fillColor('#666')
         .text('CONDICIONES:', 50, y);
      y += 14;
      doc.text('- El cliente se compromete a devolver el vehiculo en el mismo estado en que lo recibio.', 50, y, { width: 500 });
      y += 22;
      doc.text('- En caso de danos o perdida, el cliente sera responsable de los costes de reparacion/reemplazo.', 50, y, { width: 500 });
      y += 22;
      doc.text('- El deposito sera devuelto tras la inspeccion del vehiculo al momento de la devolucion.', 50, y, { width: 500 });
      
      // === SIGNATURES ===
      y = 670;
      doc.fontSize(10).fillColor('#333');
      doc.text('Firma del cliente:', 50, y);
      doc.rect(50, y + 15, 180, 50).strokeColor('#ccc').stroke();
      
      doc.text('Firma de la agencia:', 320, y);
      doc.rect(320, y + 15, 180, 50).strokeColor('#ccc').stroke();
      
      // Pied de page
      doc.fontSize(8).fillColor('#999')
         .text(`Voltride - ${rental.agency_name || ''} | ${rental.agency_email || 'info@voltride.es'} | ${rental.agency_phone || ''}`, 50, 770, { align: 'center' });
      
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
          doc.image(logoBuffer, 50, 40, { width: 100 });
        } catch (e) {
          doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
        }
      } else {
        doc.fontSize(20).fillColor('#f59e0b').text('VOLTRIDE', 50, 50);
      }
      
      // Infos agence
      doc.fontSize(9).fillColor('#666')
         .text(rental.agency_name || 'Voltride', 50, 95)
         .text(rental.agency_address || '', 50, 107)
         .text(rental.agency_phone || '', 50, 119);
      
      // Titre FACTURA
      doc.fontSize(28).fillColor('#10b981').text('FACTURA', 350, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#666')
         .text(`N.: F-${rental.contract_number}`, 350, 85, { align: 'right' })
         .text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 350, 100, { align: 'right' });
      
      // Ligne séparatrice
      doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#10b981').lineWidth(2).stroke();
      
      // === CLIENT ===
      let y = 160;
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
        doc.text(`${rental.email}`, 50, y);
      }
      if (rental.phone) {
        y += 14;
        doc.text(`${rental.phone}`, 50, y);
      }
      if (rental.address) {
        y += 14;
        doc.text(`${rental.address}`, 50, y);
      }
      
      // === DÉTAIL ===
      y += 25;
      doc.fontSize(11).fillColor('#10b981').text('DETALLE DEL ALQUILER', 50, y);
      y += 20;
      
      const col1 = 50, col2 = 300, col3 = 400, col4 = 500;
      
      // En-tête tableau
      doc.rect(50, y - 5, 495, 22).fillColor('#f0fdf4').fill();
      doc.fontSize(9).fillColor('#666')
         .text('Descripcion', col1 + 10, y)
         .text('Precio/dia', col2, y)
         .text('Qte', col3, y)
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
         .text(`${dailyRate.toFixed(2)} EUR`, col2, y)
         .text(`${days} dia(s)`, col3, y)
         .text(`${rentalTotal.toFixed(2)} EUR`, col4, y);
      y += 18;
      
      // Accessoires
      if (rental.notes && rental.notes.includes('Accesorios:')) {
        const accStr = rental.notes.replace('Accesorios:', '').trim();
        const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
        doc.fontSize(9).fillColor('#666');
        accessories.forEach(acc => {
          doc.text(`   - ${acc}`, col1, y).text('Incluido', col4, y);
          y += 13;
        });
      }
      
      // Ligne séparatrice
      y += 10;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 15;
      
      // === DÉDUCTIONS ===
      const deductions = parseFloat(rental.checkout_deductions) || 0;
      if (deductions > 0) {
        doc.fontSize(10).fillColor('#e74c3c').text('DEDUCCIONES:', col1, y);
        y += 16;
        
        if (rental.checkout_notes) {
          const deductionsList = rental.checkout_notes.split(',').map(d => d.trim());
          doc.fontSize(9).fillColor('#666');
          deductionsList.forEach(ded => {
            doc.text(`  - ${ded}`, col1 + 10, y);
            y += 13;
          });
        }
        
        y += 5;
        doc.fontSize(10).fillColor('#333').text(`Total deducciones:`, col3, y);
        doc.fillColor('#e74c3c').text(`-${deductions.toFixed(2)} EUR`, col4, y);
        y += 22;
      }
      
      // === TOTAUX ===
      const deposit = parseFloat(rental.deposit) || 0;
      const depositRefund = parseFloat(rental.checkout_refund) || (deposit - deductions);
      const rentalHT = rentalTotal / 1.21;
      const tva = rentalTotal - rentalHT;
      
      doc.moveTo(280, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 12;
      
      doc.fontSize(10).fillColor('#666');
      doc.text('Base imponible:', col3, y);
      doc.fillColor('#333').text(`${rentalHT.toFixed(2)} EUR`, col4, y);
      y += 16;
      
      doc.fillColor('#666').text('IVA 21%:', col3, y);
      doc.fillColor('#333').text(`${tva.toFixed(2)} EUR`, col4, y);
      y += 20;
      
      // Total TTC
      doc.rect(col3 - 30, y - 5, 195, 26).fillColor('#10b981').fill();
      doc.fontSize(11).fillColor('#fff')
         .text('TOTAL:', col3 - 20, y + 2)
         .text(`${rentalTotal.toFixed(2)} EUR`, col4, y + 2);
      y += 40;
      
      // === DÉPÔT ===
      doc.fontSize(10).fillColor('#333');
      doc.text(`Deposito pagado:`, col3, y);
      doc.text(`${deposit.toFixed(2)} EUR`, col4, y);
      y += 16;
      
      if (deductions > 0) {
        doc.fillColor('#e74c3c').text(`Deducciones:`, col3, y);
        doc.text(`-${deductions.toFixed(2)} EUR`, col4, y);
        y += 16;
      }
      
      // Encadré dépôt remboursé
      doc.rect(col3 - 30, y - 3, 195, 26).fillColor('#ecfdf5').fill();
      doc.rect(col3 - 30, y - 3, 195, 26).strokeColor('#10b981').stroke();
      doc.fontSize(10).fillColor('#10b981').text(`Deposito devuelto:`, col3 - 20, y + 3);
      doc.fontSize(11).text(`${depositRefund.toFixed(2)} EUR`, col4, y + 2);
      
      // === PIED DE PAGE ===
      doc.fontSize(12).fillColor('#10b981').text('Gracias por confiar en Voltride!', 50, 700, { align: 'center' });
      
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
                <p>Tel: ${data.agency_phone || '+34 600 000 001'}</p>
                <p>Email: ${data.agency_email || 'info@voltride.es'}</p>
              </div>
              
              <p style="text-align: center; font-size: 18px;">Disfruta de tu paseo!</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Voltride - Alquiler de bicicletas y vehiculos electricos</p>
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
              <p>&copy; ${new Date().getFullYear()} Voltride</p>
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
              <p>&copy; ${new Date().getFullYear()} Voltride</p>
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
              <p>&copy; ${new Date().getFullYear()} Voltride - Alquiler de bicicletas y vehiculos electricos</p>
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
              <p>&copy; ${new Date().getFullYear()} Voltride</p>
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
              https://github.com/antonybras68-voltride/voltride/blob/main/backend/services/emailService.js
              <div class="refund-box">
                <p>Deposit refunded:</p>
                <p class="amount">${data.deposit_refunded} EUR</p>
              </div>
              
              <p>Invoice attached.</p>
              <p style="text-align: center;">See you soon!</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Voltride</p>
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
