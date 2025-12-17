require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDatabase } = require('./database');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Servir les assets (logo, etc.)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rendre pool accessible aux routes
app.set('pool', pool);

// Import des routes
const authRoutes = require('./routes/auth');
const vehiclesRoutes = require('./routes/vehicles');
const customersRoutes = require('./routes/customers');
const rentalsRoutes = require('./routes/rentals');
const paymentsRoutes = require('./routes/payments');
const agenciesRoutes = require('./routes/agencies');
const reportsRoutes = require('./routes/reports');
const contractsRoutes = require('./routes/contracts');
const checkinRoutes = require('./routes/checkin');
const checkoutRoutes = require('./routes/checkout');
const ocrRoutes = require('./routes/ocr');
const invoicesRoutes = require('./routes/invoices');

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/rentals', rentalsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/agencies', agenciesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/invoices', invoicesRoutes);

// Route par défaut - renvoie l'application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Démarrage du serveur
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════╗');
      console.log('║                                            ║');
      console.log('║   ⚡ VOLTRIDE - Servidor iniciado          ║');
      console.log(`║   🌐 Puerto: ${PORT}                           ║`);
      console.log('║   ✅ Base de datos conectada               ║');
      console.log('║                                            ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
