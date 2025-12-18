
const express = require('express');
const router = express.Router();

// GET /api/pricing - Récupérer tous les paramètres tarifaires
router.get('/', async (req, res) => {
  const pool = req.app.get('pool');
  
  try {
    // Vérifier si la table existe, sinon la créer
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const result = await pool.query('SELECT key, value FROM pricing_settings');
    
    const pricing = {};
    result.rows.forEach(row => {
      pricing[row.key] = row.value;
    });
    
    res.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Error fetching pricing settings' });
  }
});

// POST /api/pricing - Sauvegarder tous les paramètres tarifaires
router.post('/', async (req, res) => {
  const pool = req.app.get('pool');
  const { vehicleTypes, accessories, insuranceOptions, damages } = req.body;
  
  try {
    // Vérifier si la table existe, sinon la créer
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Upsert chaque catégorie
    const upsertQuery = `
      INSERT INTO pricing_settings (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `;
    
    if (vehicleTypes) {
      await pool.query(upsertQuery, ['vehicleTypes', JSON.stringify(vehicleTypes)]);
    }
    
    if (accessories) {
      await pool.query(upsertQuery, ['accessories', JSON.stringify(accessories)]);
    }
    
    if (insuranceOptions) {
      await pool.query(upsertQuery, ['insuranceOptions', JSON.stringify(insuranceOptions)]);
    }
    
    if (damages) {
      await pool.query(upsertQuery, ['damages', JSON.stringify(damages)]);
    }
    
    res.json({ success: true, message: 'Pricing settings saved successfully' });
  } catch (error) {
    console.error('Error saving pricing:', error);
    res.status(500).json({ error: 'Error saving pricing settings' });
  }
});

// GET /api/pricing/vehicle/:type - Récupérer le prix pour un type de véhicule et une durée
router.get('/vehicle/:type', async (req, res) => {
  const pool = req.app.get('pool');
  const { type } = req.params;
  const { days } = req.query;
  
  try {
    const result = await pool.query(
      "SELECT value FROM pricing_settings WHERE key = 'vehicleTypes'"
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing not configured' });
    }
    
    const vehicleTypes = result.rows[0].value;
    const vehicle = vehicleTypes.find(v => v.id === type);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }
    
    if (days) {
      const numDays = parseInt(days);
      let price;
      
      if (numDays <= 14) {
        price = vehicle.prices[numDays] || 0;
      } else {
        // Prix 14 jours + jours supplémentaires
        const extraDays = numDays - 14;
        price = (vehicle.prices[14] || 0) + (extraDays * (vehicle.extraDay || 0));
      }
      
      res.json({
        vehicleType: vehicle,
        days: numDays,
        price: price,
        deposit: vehicle.deposit
      });
    } else {
      res.json(vehicle);
    }
  } catch (error) {
    console.error('Error fetching vehicle pricing:', error);
    res.status(500).json({ error: 'Error fetching vehicle pricing' });
  }
});

// GET /api/pricing/accessory/:id - Récupérer le prix pour un accessoire et une durée
router.get('/accessory/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const { id } = req.params;
  const { days } = req.query;
  
  try {
    const result = await pool.query(
      "SELECT value FROM pricing_settings WHERE key = 'accessories'"
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing not configured' });
    }
    
    const accessories = result.rows[0].value;
    const accessory = accessories.find(a => a.id === id);
    
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }
    
    if (days) {
      const numDays = parseInt(days);
      let price;
      
      if (numDays <= 14) {
        price = accessory.prices[numDays] || 0;
      } else {
        const extraDays = numDays - 14;
        price = (accessory.prices[14] || 0) + (extraDays * (accessory.extraDay || 0));
      }
      
      res.json({
        accessory: accessory,
        days: numDays,
        price: price
      });
    } else {
      res.json(accessory);
    }
  } catch (error) {
    console.error('Error fetching accessory pricing:', error);
    res.status(500).json({ error: 'Error fetching accessory pricing' });
  }
});

// GET /api/pricing/insurance - Récupérer les options d'assurance
router.get('/insurance', async (req, res) => {
  const pool = req.app.get('pool');
  
  try {
    const result = await pool.query(
      "SELECT value FROM pricing_settings WHERE key = 'insuranceOptions'"
    );
    
    if (result.rows.length === 0) {
      // Retourner les options par défaut
      return res.json([
        { id: 'none', name: 'Sans assurance', pricePerDay: 0, depositReduction: 0 },
        { id: 'basic', name: 'Assurance Basic', pricePerDay: 3, depositReduction: 50 },
        { id: 'premium', name: 'Assurance Premium', pricePerDay: 6, depositReduction: 75 }
      ]);
    }
    
    res.json(result.rows[0].value);
  } catch (error) {
    console.error('Error fetching insurance options:', error);
    res.status(500).json({ error: 'Error fetching insurance options' });
  }
});

// GET /api/pricing/damages - Récupérer la liste des dommages
router.get('/damages', async (req, res) => {
  const pool = req.app.get('pool');
  
  try {
    const result = await pool.query(
      "SELECT value FROM pricing_settings WHERE key = 'damages'"
    );
    
    if (result.rows.length === 0) {
      return res.json([]);
    }
    
    res.json(result.rows[0].value);
  } catch (error) {
    console.error('Error fetching damages:', error);
    res.status(500).json({ error: 'Error fetching damages' });
  }
});

// POST /api/pricing/calculate - Calculer le prix total d'une location
router.post('/calculate', async (req, res) => {
  const pool = req.app.get('pool');
  const { vehicleType, days, accessories: selectedAccessories, insuranceId } = req.body;
  
  try {
    // Récupérer tous les paramètres
    const result = await pool.query('SELECT key, value FROM pricing_settings');
    const pricing = {};
    result.rows.forEach(row => {
      pricing[row.key] = row.value;
    });
    
    // Trouver le véhicule
    const vehicle = (pricing.vehicleTypes || []).find(v => v.id === vehicleType);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }
    
    // Calculer le prix du véhicule
    let vehiclePrice;
    if (days <= 14) {
      vehiclePrice = vehicle.prices[days] || 0;
    } else {
      const extraDays = days - 14;
      vehiclePrice = (vehicle.prices[14] || 0) + (extraDays * (vehicle.extraDay || 0));
    }
    
    // Calculer le prix des accessoires
    let accessoriesPrice = 0;
    const accessoriesDetails = [];
    
    if (selectedAccessories && selectedAccessories.length > 0) {
      const allAccessories = pricing.accessories || [];
      
      selectedAccessories.forEach(accId => {
        const acc = allAccessories.find(a => a.id === accId);
        if (acc) {
          let accPrice;
          if (days <= 14) {
            accPrice = acc.prices[days] || 0;
          } else {
            const extraDays = days - 14;
            accPrice = (acc.prices[14] || 0) + (extraDays * (acc.extraDay || 0));
          }
          accessoriesPrice += accPrice;
          accessoriesDetails.push({ ...acc, calculatedPrice: accPrice });
        }
      });
    }
    
    // Calculer l'assurance et la caution
    let insurancePrice = 0;
    let deposit = vehicle.deposit || 0;
    let depositReduction = 0;
    
    if (insuranceId && insuranceId !== 'none') {
      const insurance = (pricing.insuranceOptions || []).find(i => i.id === insuranceId);
      if (insurance) {
        insurancePrice = (insurance.pricePerDay || 0) * days;
        depositReduction = insurance.depositReduction || 0;
        deposit = vehicle.deposit * (1 - depositReduction / 100);
      }
    }
    
    // Total
    const subtotal = vehiclePrice + accessoriesPrice + insurancePrice;
    
    res.json({
      vehicle: {
        type: vehicle,
        price: vehiclePrice
      },
      accessories: accessoriesDetails,
      accessoriesTotal: accessoriesPrice,
      insurance: {
        id: insuranceId,
        price: insurancePrice,
        depositReduction: depositReduction
      },
      deposit: Math.round(deposit * 100) / 100,
      originalDeposit: vehicle.deposit,
      subtotal: subtotal,
      days: days
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ error: 'Error calculating price' });
  }
});

module.exports = router;
