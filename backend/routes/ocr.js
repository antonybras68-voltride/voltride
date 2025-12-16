const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');

// POST /api/ocr/document - Analyser un document d'identité
router.post('/document', authMiddleware, async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image requise' });
    }
    
    // Vérifier que la clé API est configurée
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Clé API OpenAI non configurée' });
    }
    
    // Préparer l'image (enlever le préfixe data:image si présent)
    let imageData = image;
    if (image.startsWith('data:image')) {
      imageData = image; // Garder le format complet pour OpenAI
    }
    
    // Appel à l'API OpenAI Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en lectura de documentos de identidad (DNI, NIE, Pasaporte).
Tu tarea es extraer la información del documento de la imagen.

IMPORTANTE: Responde SOLO con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.

El formato de respuesta debe ser exactamente:
{
  "success": true,
  "document_type": "passport|dni|nie",
  "first_name": "NOMBRE",
  "last_name": "APELLIDOS",
  "document_number": "NUMERO",
  "birth_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY",
  "nationality": "PAIS",
  "gender": "M|F"
}

Si no puedes leer algún campo, pon null.
Si la imagen no es un documento de identidad válido, responde:
{
  "success": false,
  "error": "No se pudo leer el documento"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analiza este documento de identidad y extrae toda la información visible. Responde SOLO con el JSON, sin texto adicional.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      return res.status(500).json({ 
        error: 'Error al analizar el documento',
        details: error.error?.message || 'Error desconocido'
      });
    }
    
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      return res.status(500).json({ error: 'Respuesta vacía de OpenAI' });
    }
    
    // Parser la réponse JSON
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      
      const documentData = JSON.parse(cleanContent);
      
      console.log('✅ Document analysé:', documentData);
      
      res.json(documentData);
      
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', content);
      res.status(500).json({ 
        error: 'Error al interpretar la respuesta',
        raw: content 
      });
    }
    
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
});

module.exports = router;
