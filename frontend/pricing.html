<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voltride - Configuración Tarifaria</title>
  <link rel="stylesheet" href="/css/styles.css">
  <style>
    .pricing-container { max-width: 1200px; margin: 0 auto; padding: 20px; padding-bottom: 100px; }
    .pricing-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
    .pricing-header h1 { font-size: 1.8rem; color: var(--text-primary); }
    .tabs { display: flex; gap: 5px; margin-bottom: 25px; flex-wrap: wrap; background: var(--bg-card); padding: 8px; border-radius: 12px; }
    .tab-btn { padding: 12px 24px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-radius: 8px; font-size: 0.95rem; font-weight: 500; transition: all 0.2s; }
    .tab-btn:hover { background: var(--bg-input); color: var(--text-primary); }
    .tab-btn.active { background: var(--primary); color: var(--bg-dark); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .pricing-card { background: var(--bg-card); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
    .pricing-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }
    .pricing-card-header h2 { font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    .pricing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; margin-bottom: 20px; }
    .pricing-day { text-align: center; }
    .pricing-day label { display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 5px; }
    .pricing-day input { width: 100%; padding: 8px 4px; text-align: center; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 0.85rem; }
    .pricing-day input:focus { outline: none; border-color: var(--primary); }
    .pricing-day.half-day { background: rgba(245, 158, 11, 0.1); border-radius: 8px; padding: 5px; }
    .pricing-day.half-day label { color: var(--primary); font-weight: bold; }
    .extra-fields { display: flex; gap: 20px; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border); flex-wrap: wrap; align-items: center; }
    .extra-field { display: flex; align-items: center; gap: 10px; }
    .extra-field label { color: var(--text-secondary); font-size: 0.85rem; white-space: nowrap; }
    .extra-field input { width: 80px; padding: 8px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); text-align: center; }
    .deposit-field { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
    .deposit-field label { color: var(--text-secondary); font-size: 0.9rem; }
    .deposit-field input { width: 120px; padding: 10px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); text-align: center; }
    .insurance-option { display: flex; align-items: center; justify-content: space-between; padding: 20px; background: var(--bg-input); border-radius: 10px; margin-bottom: 15px; flex-wrap: wrap; gap: 15px; }
    .insurance-info { flex: 1; min-width: 200px; }
    .insurance-info h3 { font-size: 1rem; margin-bottom: 5px; }
    .insurance-info p { font-size: 0.85rem; color: var(--text-secondary); }
    .insurance-values { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
    .insurance-field { text-align: center; }
    .insurance-field label { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 5px; }
    .insurance-field input { width: 90px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); text-align: center; }
    .damage-item { display: grid; grid-template-columns: 1fr 100px auto; gap: 15px; align-items: center; padding: 15px; background: var(--bg-input); border-radius: 10px; margin-bottom: 10px; }
    .damage-item input[type="text"] { padding: 10px 15px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); }
    .damage-item input[type="number"] { padding: 10px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); text-align: center; }
    .add-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 15px; background: transparent; border: 2px dashed var(--border); border-radius: 10px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-size: 0.95rem; }
    .add-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(245, 158, 11, 0.1); }
    .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); padding: 15px 30px; display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid var(--border); z-index: 100; }
    .deposit-info { background: rgba(59, 130, 246, 0.1); border: 1px solid var(--info); border-radius: 10px; padding: 15px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
    .deposit-info-icon { font-size: 1.5rem; }
    .deposit-info p { color: var(--text-secondary); font-size: 0.9rem; }
    .deposit-info strong { color: var(--info); }
    .image-upload { margin-bottom: 15px; }
    .image-preview { width: 80px; height: 80px; background: var(--bg-input); border: 2px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; }
    .image-preview img { width: 100%; height: 100%; object-fit: contain; }
    .image-preview:hover { border-color: var(--primary); }
    .compatible-types { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
    .compatible-types label { display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px; }
    .compatible-types-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .compatible-type-tag { padding: 5px 12px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 20px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
    .compatible-type-tag.active { background: var(--primary); color: var(--bg-dark); border-color: var(--primary); }
    @media (max-width: 768px) {
      .pricing-container { padding: 15px; padding-bottom: 120px; }
      .tabs { overflow-x: auto; flex-wrap: nowrap; }
      .tab-btn { padding: 10px 16px; font-size: 0.85rem; white-space: nowrap; }
      .pricing-grid { grid-template-columns: repeat(5, 1fr); }
      .insurance-option { flex-direction: column; align-items: flex-start; }
      .damage-item { grid-template-columns: 1fr; gap: 10px; }
      .save-bar { flex-direction: column; }
      .save-bar .btn { width: 100%; }
      .extra-fields { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="pricing-container">
    <div class="pricing-header">
      <div>
        <h1>⚙️ Configuración Tarifaria</h1>
        <p style="color: var(--text-secondary);">Configure los precios de vehículos, accesorios y daños</p>
      </div>
      <a href="/app.html" class="btn btn-secondary">← Volver</a>
    </div>
    
    <div class="tabs">
      <button class="tab-btn active" data-tab="vehicles">🚲 Vehículos</button>
      <button class="tab-btn" data-tab="accessories">🎒 Accesorios</button>
      <button class="tab-btn" data-tab="insurance">🛡️ Seguros</button>
      <button class="tab-btn" data-tab="damages">⚠️ Daños</button>
    </div>
    
    <div class="tab-content active" id="tab-vehicles">
      <div class="deposit-info">
        <span class="deposit-info-icon">💡</span>
        <p>Los precios incluyen <strong>media jornada (4h)</strong> y de 1 a 14 días. <strong>24h = 1 día</strong>. +1h gratis, >1h = día extra.</p>
      </div>
      <div id="vehiclesPricingList"></div>
      <button class="add-btn" onclick="showAddVehicleTypeModal()"><span>+</span> Añadir tipo de vehículo</button>
    </div>
    
    <div class="tab-content" id="tab-accessories">
      <div class="deposit-info">
        <span class="deposit-info-icon">💡</span>
        <p>Configure precios y <strong>tipos de vehículo compatibles</strong> para cada accesorio.</p>
      </div>
      <div id="accessoriesPricingList"></div>
      <button class="add-btn" onclick="showAddAccessoryModal()"><span>+</span> Añadir accesorio</button>
    </div>
    
    <div class="tab-content" id="tab-insurance">
      <div class="pricing-card">
        <div class="pricing-card-header"><h2>🛡️ Opciones de seguro</h2></div>
        <div class="deposit-info">
          <span class="deposit-info-icon">ℹ️</span>
          <p>El seguro reduce la caución según el porcentaje configurado.</p>
        </div>
        <div id="insuranceOptionsList"></div>
        <button class="add-btn" onclick="showAddInsuranceModal()"><span>+</span> Añadir seguro</button>
      </div>
    </div>
    
    <div class="tab-content" id="tab-damages">
      <div class="pricing-card">
        <div class="pricing-card-header"><h2>⚠️ Tarifas de daños</h2></div>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">Importes a cobrar por tipo de daño en check-out.</p>
        <div id="damagesPricingList"></div>
        <button class="add-btn" onclick="addDamageRow()"><span>+</span> Añadir daño</button>
      </div>
    </div>
    
    <div class="save-bar">
      <button class="btn btn-secondary" onclick="window.location.href='/app.html'">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAllPricing()">💾 Guardar todo</button>
    </div>
  </div>
  
  <div class="modal-overlay" id="modalOverlay"><div class="modal" id="modalContent"></div></div>
  
  <script src="/js/api.js"></script>
  <script>
    let vehicleTypes = [], accessories = [], insuranceOptions = [], damages = [];
    
    document.addEventListener('DOMContentLoaded', () => {
      if (!localStorage.getItem('voltride_token')) { window.location.href = '/'; return; }
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
      });
      loadAllPricing();
    });
    
    async function loadAllPricing() {
      try {
        const res = await fetch('/api/pricing', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('voltride_token') } });
        if (res.ok) {
          const data = await res.json();
          vehicleTypes = data.vehicleTypes || getDefaultVehicleTypes();
          accessories = data.accessories || getDefaultAccessories();
          insuranceOptions = data.insuranceOptions || getDefaultInsuranceOptions();
          damages = data.damages || getDefaultDamages();
        } else throw new Error();
      } catch (e) {
        vehicleTypes = getDefaultVehicleTypes();
        accessories = getDefaultAccessories();
        insuranceOptions = getDefaultInsuranceOptions();
        damages = getDefaultDamages();
      }
      renderVehicleTypes(); renderAccessories(); renderInsuranceOptions(); renderDamages();
    }
    
    function getDefaultVehicleTypes() {
      return [
        { id: 'bike', name: 'City Bike', icon: '🚲', deposit: 100, halfDay: 8, prices: { 1: 12, 2: 22, 3: 30, 4: 38, 5: 45, 6: 52, 7: 58, 8: 64, 9: 70, 10: 75, 11: 80, 12: 85, 13: 90, 14: 95 }, extraDay: 6, image: null },
        { id: 'ebike', name: 'E-Bike', icon: '⚡', deposit: 300, halfDay: 20, prices: { 1: 30, 2: 55, 3: 78, 4: 100, 5: 120, 6: 138, 7: 154, 8: 168, 9: 182, 10: 195, 11: 207, 12: 218, 13: 228, 14: 238 }, extraDay: 15, image: null },
        { id: 'scooter', name: 'E-Scooter', icon: '🛵', deposit: 500, halfDay: 30, prices: { 1: 45, 2: 85, 3: 120, 4: 150, 5: 175, 6: 198, 7: 220, 8: 240, 9: 258, 10: 275, 11: 290, 12: 304, 13: 317, 14: 329 }, extraDay: 20, image: null }
      ];
    }
    
    function getDefaultAccessories() {
      return [
        { id: 'helmet', name: 'Casco', icon: '⛑️', halfDay: 0, prices: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 }, extraDay: 0, deposit: 25, image: null, compatibleTypes: [] },
        { id: 'lock', name: 'Candado', icon: '🔒', halfDay: 0, prices: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 }, extraDay: 0, deposit: 15, image: null, compatibleTypes: [] },
        { id: 'basket', name: 'Cesta', icon: '🧺', halfDay: 2, prices: { 1: 3, 2: 5, 3: 7, 4: 9, 5: 11, 6: 13, 7: 15, 8: 17, 9: 19, 10: 20, 11: 21, 12: 22, 13: 23, 14: 24 }, extraDay: 1, deposit: 20, image: null, compatibleTypes: ['bike', 'ebike'] },
        { id: 'child_seat', name: 'Silla Niño', icon: '👶', halfDay: 4, prices: { 1: 6, 2: 11, 3: 15, 4: 19, 5: 23, 6: 27, 7: 30, 8: 33, 9: 36, 10: 39, 11: 42, 12: 44, 13: 46, 14: 48 }, extraDay: 3, deposit: 40, image: null, compatibleTypes: ['bike', 'ebike'] },
        { id: 'phone_holder', name: 'Soporte Móvil', icon: '📱', halfDay: 1, prices: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5, 12: 5, 13: 5, 14: 5 }, extraDay: 0, deposit: 15, image: null, compatibleTypes: [] }
      ];
    }
    
    function getDefaultInsuranceOptions() {
      return [
        { id: 'none', name: 'Sin seguro', description: 'Caución completa', pricePerDay: 0, depositReduction: 0 },
        { id: 'basic', name: 'Seguro Básico', description: 'Daños accidentales', pricePerDay: 4, depositReduction: 50 },
        { id: 'premium', name: 'Seguro Premium', description: 'Cobertura total + robo', pricePerDay: 8, depositReduction: 75 }
      ];
    }
    
    function getDefaultDamages() {
      return [
        { id: 1, name: 'Pinchazo', price: 15 }, { id: 2, name: 'Cámara de aire', price: 10 }, { id: 3, name: 'Freno dañado', price: 25 },
        { id: 4, name: 'Cadena rota', price: 20 }, { id: 5, name: 'Desviador torcido', price: 35 }, { id: 6, name: 'Manillar torcido', price: 30 },
        { id: 7, name: 'Sillín dañado', price: 25 }, { id: 8, name: 'Luz rota', price: 15 }, { id: 9, name: 'Timbre perdido', price: 5 },
        { id: 10, name: 'Rayadura', price: 20 }, { id: 11, name: 'Pedal roto', price: 20 }, { id: 12, name: 'Rueda doblada', price: 40 },
        { id: 13, name: 'Batería dañada', price: 200 }, { id: 14, name: 'Pantalla rota', price: 80 }, { id: 15, name: 'Cargador perdido', price: 45 }
      ];
    }
    
    // VÉHICULES
    function renderVehicleTypes() {
      document.getElementById('vehiclesPricingList').innerHTML = vehicleTypes.map((v, i) => `
        <div class="pricing-card">
          <div class="pricing-card-header">
            <h2>${v.icon} ${v.name}</h2>
            <div style="display: flex; gap: 10px; align-items: center;">
              <div class="image-preview" onclick="document.getElementById('vImg${i}').click()" title="Subir imagen">
                ${v.image ? `<img src="${v.image}">` : '📷'}
              </div>
              <input type="file" id="vImg${i}" accept="image/*" style="display:none;" onchange="handleVImg(${i}, this)">
              <button class="btn btn-sm btn-danger" onclick="delVehicle(${i})">🗑️</button>
            </div>
          </div>
          <div class="deposit-field"><label>Caución (€):</label><input type="number" value="${v.deposit}" onchange="vehicleTypes[${i}].deposit=parseFloat(this.value)||0"></div>
          <label style="display:block;font-size:0.9rem;color:var(--text-secondary);margin-bottom:10px;">Precios por duración</label>
          <div class="pricing-grid">
            <div class="pricing-day half-day"><label>½ día</label><input type="number" value="${v.halfDay||0}" onchange="vehicleTypes[${i}].halfDay=parseFloat(this.value)||0"></div>
            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d=>`<div class="pricing-day"><label>${d}d</label><input type="number" value="${v.prices[d]||0}" onchange="vehicleTypes[${i}].prices[${d}]=parseFloat(this.value)||0"></div>`).join('')}
          </div>
          <div class="extra-fields"><div class="extra-field"><label>Día extra (>14d):</label><input type="number" value="${v.extraDay||0}" onchange="vehicleTypes[${i}].extraDay=parseFloat(this.value)||0"> €</div></div>
        </div>
      `).join('');
    }
    function handleVImg(i, input) { if(input.files[0]){ const r=new FileReader(); r.onload=e=>{vehicleTypes[i].image=e.target.result;renderVehicleTypes();}; r.readAsDataURL(input.files[0]); } }
    function delVehicle(i) { if(confirm('¿Eliminar?')){ vehicleTypes.splice(i,1); renderVehicleTypes(); } }
    function showAddVehicleTypeModal() {
      openModal('Añadir vehículo', `
        <div class="form-group"><label>Nombre</label><input type="text" id="nvName" class="form-control"></div>
        <div class="form-group"><label>Icono</label><input type="text" id="nvIcon" class="form-control" value="🚲" maxlength="2"></div>
        <div class="form-group"><label>Caución (€)</label><input type="number" id="nvDep" class="form-control" value="100"></div>
        <div class="form-group"><label>Precio ½ día (€)</label><input type="number" id="nvHalf" class="form-control" value="0"></div>
      `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="addVehicle()">Añadir</button>`);
    }
    function addVehicle() {
      const name=document.getElementById('nvName').value; if(!name){alert('Nombre requerido');return;}
      vehicleTypes.push({ id:name.toLowerCase().replace(/\s+/g,'_'), name, icon:document.getElementById('nvIcon').value||'🚲', deposit:parseFloat(document.getElementById('nvDep').value)||100, halfDay:parseFloat(document.getElementById('nvHalf').value)||0, prices:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0}, extraDay:0, image:null });
      closeModal(); renderVehicleTypes();
    }
    
    // ACCESSOIRES
    function renderAccessories() {
      document.getElementById('accessoriesPricingList').innerHTML = accessories.map((a, i) => `
        <div class="pricing-card">
          <div class="pricing-card-header">
            <h2>${a.icon} ${a.name}</h2>
            <div style="display: flex; gap: 10px; align-items: center;">
              <div class="image-preview" onclick="document.getElementById('aImg${i}').click()">
                ${a.image ? `<img src="${a.image}">` : '📷'}
              </div>
              <input type="file" id="aImg${i}" accept="image/*" style="display:none;" onchange="handleAImg(${i}, this)">
              <button class="btn btn-sm btn-danger" onclick="delAccessory(${i})">🗑️</button>
            </div>
          </div>
          <div class="deposit-field"><label>Caución si no devuelto (€):</label><input type="number" value="${a.deposit||0}" onchange="accessories[${i}].deposit=parseFloat(this.value)||0"></div>
          <label style="display:block;font-size:0.9rem;color:var(--text-secondary);margin-bottom:10px;">Precios por duración</label>
          <div class="pricing-grid">
            <div class="pricing-day half-day"><label>½ día</label><input type="number" value="${a.halfDay||0}" onchange="accessories[${i}].halfDay=parseFloat(this.value)||0"></div>
            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d=>`<div class="pricing-day"><label>${d}d</label><input type="number" value="${a.prices[d]||0}" onchange="accessories[${i}].prices[${d}]=parseFloat(this.value)||0"></div>`).join('')}
          </div>
          <div class="extra-fields"><div class="extra-field"><label>Día extra:</label><input type="number" value="${a.extraDay||0}" onchange="accessories[${i}].extraDay=parseFloat(this.value)||0"> €</div></div>
          <div class="compatible-types">
            <label>Tipos compatibles (vacío = todos):</label>
            <div class="compatible-types-grid">
              ${vehicleTypes.map(vt=>`<span class="compatible-type-tag ${(a.compatibleTypes||[]).includes(vt.id)?'active':''}" onclick="toggleCompat(${i},'${vt.id}')">${vt.icon} ${vt.name}</span>`).join('')}
            </div>
          </div>
        </div>
      `).join('');
    }
    function handleAImg(i, input) { if(input.files[0]){ const r=new FileReader(); r.onload=e=>{accessories[i].image=e.target.result;renderAccessories();}; r.readAsDataURL(input.files[0]); } }
    function toggleCompat(i, vt) { if(!accessories[i].compatibleTypes)accessories[i].compatibleTypes=[]; const idx=accessories[i].compatibleTypes.indexOf(vt); if(idx>-1)accessories[i].compatibleTypes.splice(idx,1); else accessories[i].compatibleTypes.push(vt); renderAccessories(); }
    function delAccessory(i) { if(confirm('¿Eliminar?')){ accessories.splice(i,1); renderAccessories(); } }
    function showAddAccessoryModal() {
      openModal('Añadir accesorio', `
        <div class="form-group"><label>Nombre</label><input type="text" id="naName" class="form-control"></div>
        <div class="form-group"><label>Icono</label><input type="text" id="naIcon" class="form-control" value="🎒" maxlength="2"></div>
        <div class="form-group"><label>Caución (€)</label><input type="number" id="naDep" class="form-control" value="0"></div>
      `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="addAccessory()">Añadir</button>`);
    }
    function addAccessory() {
      const name=document.getElementById('naName').value; if(!name){alert('Nombre requerido');return;}
      accessories.push({ id:name.toLowerCase().replace(/\s+/g,'_'), name, icon:document.getElementById('naIcon').value||'🎒', deposit:parseFloat(document.getElementById('naDep').value)||0, halfDay:0, prices:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0}, extraDay:0, image:null, compatibleTypes:[] });
      closeModal(); renderAccessories();
    }
    
    // ASSURANCES
    function renderInsuranceOptions() {
      document.getElementById('insuranceOptionsList').innerHTML = insuranceOptions.map((ins, i) => `
        <div class="insurance-option">
          <div class="insurance-info"><h3>${ins.name}</h3><p>${ins.description}</p></div>
          <div class="insurance-values">
            <div class="insurance-field"><label>Precio/día (€)</label><input type="number" value="${ins.pricePerDay}" onchange="insuranceOptions[${i}].pricePerDay=parseFloat(this.value)||0"></div>
            <div class="insurance-field"><label>Reducción (%)</label><input type="number" value="${ins.depositReduction}" min="0" max="100" onchange="insuranceOptions[${i}].depositReduction=Math.min(100,parseFloat(this.value)||0)"></div>
            ${i>0?`<button class="btn btn-sm btn-danger" onclick="delInsurance(${i})">🗑️</button>`:''}
          </div>
        </div>
      `).join('');
    }
    function delInsurance(i) { if(confirm('¿Eliminar?')){ insuranceOptions.splice(i,1); renderInsuranceOptions(); } }
    function showAddInsuranceModal() {
      openModal('Añadir seguro', `
        <div class="form-group"><label>Nombre</label><input type="text" id="niName" class="form-control"></div>
        <div class="form-group"><label>Descripción</label><input type="text" id="niDesc" class="form-control"></div>
        <div class="form-row"><div class="form-group"><label>Precio/día (€)</label><input type="number" id="niPrice" class="form-control" value="5"></div>
        <div class="form-group"><label>Reducción (%)</label><input type="number" id="niRed" class="form-control" value="50"></div></div>
      `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="addInsurance()">Añadir</button>`);
    }
    function addInsurance() {
      const name=document.getElementById('niName').value; if(!name){alert('Nombre requerido');return;}
      insuranceOptions.push({ id:name.toLowerCase().replace(/\s+/g,'_'), name, description:document.getElementById('niDesc').value, pricePerDay:parseFloat(document.getElementById('niPrice').value)||0, depositReduction:Math.min(100,parseFloat(document.getElementById('niRed').value)||0) });
      closeModal(); renderInsuranceOptions();
    }
    
    // DOMMAGES
    function renderDamages() {
      document.getElementById('damagesPricingList').innerHTML = damages.map((d, i) => `
        <div class="damage-item">
          <input type="text" value="${d.name}" onchange="damages[${i}].name=this.value">
          <input type="number" value="${d.price}" onchange="damages[${i}].price=parseFloat(this.value)||0">
          <button class="btn btn-sm btn-danger" onclick="damages.splice(${i},1);renderDamages()">🗑️</button>
        </div>
      `).join('');
    }
    function addDamageRow() { damages.push({id:Date.now(),name:'',price:0}); renderDamages(); }
    
    // MODAL
    function openModal(title, body, footer='') {
      document.getElementById('modalContent').innerHTML = `<div class="modal-header"><h2>${title}</h2><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
      document.getElementById('modalOverlay').classList.add('active');
    }
    function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }
    
    // SAVE
    async function saveAllPricing() {
      const data = { vehicleTypes, accessories, insuranceOptions, damages:damages.filter(d=>d.name?.trim()) };
      try {
        const res = await fetch('/api/pricing', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('voltride_token')}, body:JSON.stringify(data) });
        if(res.ok) showToast('¡Guardado!','success'); else throw new Error();
      } catch(e) { localStorage.setItem('voltride_pricing',JSON.stringify(data)); showToast('Guardado localmente','warning'); }
    }
    function showToast(msg, type='info') {
      const t=document.createElement('div');
      t.style.cssText=`position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:10px;color:white;font-weight:500;z-index:2000;background:${type==='success'?'#22c55e':type==='warning'?'#f59e0b':'#ef4444'}`;
      t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
    }
  </script>
</body>
</html>
