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
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: to,
        subject: subject,
        html: html,
        attachments: attachments
      })
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
                <p>Si tienes alguna pregunta, no dudes en contactarnos:</p>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>¡Disfruta de tu paseo! 🚲</p>
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
                <p>Pour toute question, contactez-nous :</p>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>Bonne balade ! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Location de vélos et véhicules électriques</p>
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
                <p>For any questions, contact us:</p>
                <p>📱 +34 600 000 001</p>
                <p>📧 info@voltride.es</p>
              </div>
              
              <p>Enjoy your ride! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Bike and electric vehicle rental</p>
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
              <p>Factura y resumen de tu alquiler</p>
            </div>
            <div class="content">
              <p>Hola <strong>${data.customer_name}</strong>,</p>
              <p>Gracias por haber elegido Voltride. Aquí tienes el resumen de tu alquiler:</p>
              
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
              
              <p>📎 Encontrarás la factura detallada en el archivo adjunto.</p>
              
              <p>¡Esperamos verte pronto! 🚲</p>
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
              <p>Facture et résumé de votre location</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${data.customer_name}</strong>,</p>
              <p>Merci d'avoir choisi Voltride. Voici le résumé de votre location :</p>
              
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
              
              <p>📎 Vous trouverez la facture détaillée en pièce jointe.</p>
              
              <p>À bientôt ! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Location de vélos et véhicules électriques</p>
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
              <p>Invoice and rental summary</p>
            </div>
            <div class="content">
              <p>Hello <strong>${data.customer_name}</strong>,</p>
              <p>Thank you for choosing Voltride. Here is your rental summary:</p>
              
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
              
              <p>📎 You will find the detailed invoice attached.</p>
              
              <p>See you soon! 🚲</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Voltride - Bike and electric vehicle rental</p>
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
  getContractEmailTemplate,
  getInvoiceEmailTemplate
};
