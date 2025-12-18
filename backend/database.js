const { Pool } = require('pg');

// Connexion à PostgreSQL (Railway fournit DATABASE_URL automatiquement)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Création des tables au démarrage
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // Table des agences
    await client.query(`
      CREATE TABLE IF NOT EXISTS agencies (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des utilisateurs
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'employee',
        agency_id INTEGER REFERENCES agencies(id),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des véhicules
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        brand VARCHAR(50),
        model VARCHAR(50),
        color VARCHAR(30),
        daily_rate DECIMAL(10,2) NOT NULL,
        deposit DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'available',
        agency_id INTEGER REFERENCES agencies(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Nouvelles colonnes pour véhicules (maintenance tracking)
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS license_plate VARCHAR(20)`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(50)`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_km INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_maintenance_km INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS total_rental_days INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_maintenance_date TIMESTAMP`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_maintenance_km INTEGER`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_maintenance_date DATE`);

    // Table des clients
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        id_type VARCHAR(30),
        id_number VARCHAR(50),
        address TEXT,
        city VARCHAR(50),
        country VARCHAR(50),
        preferred_language VARCHAR(5) DEFAULT 'es',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ajouter colonnes si elles n'existent pas (pour les bases existantes)
    await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'es'`);

    // Table des locations
    await client.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        contract_number VARCHAR(20) UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        vehicle_id INTEGER REFERENCES vehicles(id),
        agency_id INTEGER REFERENCES agencies(id),
        user_id INTEGER REFERENCES users(id),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        planned_end_date TIMESTAMP,
        daily_rate DECIMAL(10,2) NOT NULL,
        deposit DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2),
        deposit_paid DECIMAL(10,2) DEFAULT 0,
        amount_paid DECIMAL(10,2) DEFAULT 0,
        payment_method VARCHAR(20),
        deposit_method VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        signature_customer TEXT,
        checkout_deductions DECIMAL(10,2) DEFAULT 0,
        checkout_refund DECIMAL(10,2) DEFAULT 0,
        checkout_refund_method VARCHAR(20),
        checkout_inspection TEXT,
        checkout_ticket_photo TEXT,
        checkout_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ajouter colonnes rentals si elles n'existent pas
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS deposit_method VARCHAR(20)`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS signature_customer TEXT`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_deductions DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_refund DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_refund_method VARCHAR(20)`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_inspection TEXT`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_ticket_photo TEXT`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS checkout_notes TEXT`);
    // Nouvelles colonnes pour km motos
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS start_km INTEGER`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS end_km INTEGER`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS km_traveled INTEGER`);

    // Table des paiements (caisse)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        rental_id INTEGER REFERENCES rentals(id),
        agency_id INTEGER REFERENCES agencies(id),
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_type VARCHAR(20) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des rapports Z (clôture de caisse)
    await client.query(`
      CREATE TABLE IF NOT EXISTS z_reports (
        id SERIAL PRIMARY KEY,
        report_number VARCHAR(20) UNIQUE NOT NULL,
        agency_id INTEGER REFERENCES agencies(id),
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        total_cash DECIMAL(10,2) DEFAULT 0,
        total_card DECIMAL(10,2) DEFAULT 0,
        total_transfer DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        rentals_count INTEGER DEFAULT 0,
        returns_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // =====================================================
    // TABLE MAINTENANCE_RECORDS (Nouveau)
    // =====================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        rental_id INTEGER REFERENCES rentals(id),
        type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'normal',
        description TEXT,
        reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reported_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES users(id),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        completed_by INTEGER REFERENCES users(id),
        photos_before JSONB,
        photos_after JSONB,
        parts_used TEXT,
        cost DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index pour améliorer les performances
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_records(type)`);

    // =====================================================
    // TABLE PRICING_SETTINGS (Pour les tarifs)
    // =====================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insérer les agences par défaut si elles n'existent pas
    await client.query(`
      INSERT INTO agencies (code, name, address, phone)
      VALUES 
        ('AG-01', 'Voltride Torrevieja', 'Playa del Cura, Torrevieja', '+34 600 000 001'),
        ('AG-02', 'Voltride Centro', 'Centro, Torrevieja', '+34 600 000 002')
      ON CONFLICT (code) DO NOTHING
    `);

    // Créer un utilisateur admin par défaut si aucun utilisateur n'existe
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, password, full_name, role, agency_id)
        VALUES ('admin', $1, 'Administrador', 'admin', 1)
      `, [hashedPassword]);
      console.log('✅ Usuario admin creado (usuario: admin, contraseña: admin123)');
    }

    console.log('✅ Base de datos inicializada correctamente');
    console.log('✅ Tabla maintenance_records creada/verificada');
    
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
