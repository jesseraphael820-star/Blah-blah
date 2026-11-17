// Modelos de veículos originais. Velocidades em px/s (1 px ≈ 0,11 m → km/h = px/s × 0,4).

export const KMH = 0.4;

export const MODELS = {
  brisa: { name: 'Brisa', cls: 'Popular', style: 'hatch', l: 36, w: 19, maxSpeed: 340, accel: 210, brake: 430, turn: 3.0, grip: 9, mass: 1.0, hp: 100, price: 3000,
    colors: ['#c94f3d', '#3d7ac9', '#e3c34a', '#f2f2f2', '#4aa36b', '#8a8f96'] },
  pardal: { name: 'Pardal', cls: 'Popular', style: 'hatch', l: 33, w: 18, maxSpeed: 310, accel: 220, brake: 430, turn: 3.2, grip: 9.5, mass: 0.9, hp: 90, price: 2200,
    colors: ['#e07a2f', '#6ab0d8', '#d6d6d6', '#b33a5a', '#5f6a3a'] },
  corsario: { name: 'Corsário', cls: 'Sedã', style: 'sedan', l: 42, w: 20, maxSpeed: 380, accel: 225, brake: 450, turn: 2.7, grip: 9, mass: 1.25, hp: 120, price: 5500,
    colors: ['#2b3d5c', '#6b6f75', '#ededed', '#5a2b2b', '#2f4f3f', '#191919'] },
  monarca: { name: 'Monarca', cls: 'Sedã de luxo', style: 'sedan', l: 46, w: 21, maxSpeed: 430, accel: 260, brake: 480, turn: 2.6, grip: 9.5, mass: 1.4, hp: 130, price: 11000,
    colors: ['#c0c4ca', '#141414', '#3d1f3a', '#f0eee6'] },
  faisca: { name: 'Faísca GT', cls: 'Esportivo', style: 'sport', l: 41, w: 20, maxSpeed: 560, accel: 360, brake: 560, turn: 3.0, grip: 11, mass: 1.1, hp: 100, price: 25000,
    colors: ['#d1261d', '#f2c21b', '#1b6fd1', '#f2f2f2', '#18a35a'] },
  grauna: { name: 'Graúna', cls: 'Esportivo', style: 'sport', l: 40, w: 20, maxSpeed: 520, accel: 330, brake: 540, turn: 3.1, grip: 10.5, mass: 1.05, hp: 95, price: 19000,
    colors: ['#121212', '#4b2a6b', '#0f5d5d', '#a33'] },
  raio: { name: 'Raio V8', cls: 'Muscle', style: 'muscle', l: 44, w: 21, maxSpeed: 500, accel: 340, brake: 470, turn: 2.6, grip: 8, mass: 1.3, hp: 125, price: 16000,
    colors: ['#e2622a', '#1f3f8a', '#202020', '#8a1f1f', '#e8d24a'] },
  taxi: { name: 'Táxi Brasa', cls: 'Táxi', style: 'taxi', l: 42, w: 20, maxSpeed: 370, accel: 220, brake: 450, turn: 2.8, grip: 9, mass: 1.25, hp: 115, price: 6000,
    colors: ['#f2c21b'] },
  tatu: { name: 'Tatu', cls: 'Caminhonete', style: 'pickup', l: 46, w: 22, maxSpeed: 360, accel: 230, brake: 420, turn: 2.5, grip: 8.5, mass: 1.6, hp: 150, price: 8000,
    colors: ['#7a3a22', '#2f5a3a', '#d9d9d9', '#3a3a3a', '#b8902a'] },
  serrano: { name: 'Serrano', cls: 'Utilitário', style: 'suv', l: 46, w: 23, maxSpeed: 380, accel: 240, brake: 440, turn: 2.5, grip: 8.5, mass: 1.7, hp: 160, price: 13000,
    colors: ['#1c2b38', '#6d7a5a', '#f0f0f0', '#5a1c1c'] },
  jangada: { name: 'Jangada', cls: 'Van', style: 'van', l: 50, w: 23, maxSpeed: 300, accel: 170, brake: 380, turn: 2.2, grip: 8, mass: 2.0, hp: 170, price: 7000,
    colors: ['#e8e8e4', '#2a5f8f', '#8f2a2a', '#a8a8a0'] },
  bisao: { name: 'Bisão', cls: 'Caminhão', style: 'truck', l: 72, w: 26, maxSpeed: 260, accel: 120, brake: 320, turn: 1.7, grip: 7.5, mass: 3.6, hp: 280, price: 18000,
    colors: ['#c2401f', '#2f5f9a', '#e3e3e3', '#3a6b2a'] },
  mamute: { name: 'Mamute', cls: 'Caminhão baú', style: 'truck', l: 64, w: 25, maxSpeed: 270, accel: 130, brake: 330, turn: 1.8, grip: 7.5, mass: 3.2, hp: 240, price: 15000,
    colors: ['#f0f0ec', '#e8b62a', '#4a7a9a'] },
  socorro: { name: 'Socorro', cls: 'Ambulância', style: 'ambulance', l: 52, w: 23, maxSpeed: 360, accel: 210, brake: 420, turn: 2.3, grip: 8.5, mass: 2.0, hp: 170, price: 9000,
    colors: ['#f4f4f0'] },
  patrulha: { name: 'Patrulha', cls: 'Polícia', style: 'police', l: 44, w: 21, maxSpeed: 470, accel: 300, brake: 500, turn: 2.8, grip: 10, mass: 1.45, hp: 150, price: 0, police: true,
    colors: ['#16181d'] },
  tatica: { name: 'Tática', cls: 'Polícia tática', style: 'policevan', l: 52, w: 24, maxSpeed: 430, accel: 280, brake: 480, turn: 2.4, grip: 9.5, mass: 2.3, hp: 230, price: 0, police: true,
    colors: ['#20242c'] },
};

// Modelos que aparecem no trânsito, por distrito (pesos).
export const TRAFFIC_BY_DISTRICT = {
  0: ['brisa', 'corsario', 'corsario', 'monarca', 'taxi', 'taxi', 'taxi', 'pardal', 'grauna', 'serrano', 'jangada'],
  1: ['brisa', 'brisa', 'pardal', 'pardal', 'corsario', 'serrano', 'tatu', 'raio', 'taxi'],
  2: ['bisao', 'mamute', 'mamute', 'tatu', 'tatu', 'jangada', 'brisa', 'pardal'],
  3: ['bisao', 'bisao', 'mamute', 'jangada', 'tatu', 'pardal'],
  4: ['tatu', 'raio', 'brisa', 'pardal', 'jangada', 'corsario', 'grauna'],
  5: ['brisa', 'pardal', 'jangada', 'taxi', 'corsario', 'tatu', 'socorro', 'faisca'],
  6: ['brisa', 'corsario', 'tatu'],
};

export const PARKED_MODELS = ['brisa', 'pardal', 'corsario', 'monarca', 'faisca', 'grauna', 'raio', 'taxi', 'tatu', 'serrano', 'jangada', 'brisa', 'corsario', 'pardal'];

// Modelos comprados na concessionária (desbloqueio por missão da história).
export const SHOP = [
  { model: 'pardal', unlock: null },
  { model: 'brisa', unlock: null },
  { model: 'corsario', unlock: 's2' },
  { model: 'tatu', unlock: 's2' },
  { model: 'taxi', unlock: 's3' },
  { model: 'serrano', unlock: 's3' },
  { model: 'monarca', unlock: 's4' },
  { model: 'raio', unlock: 's5' },
  { model: 'grauna', unlock: 's6' },
  { model: 'faisca', unlock: 's7' },
  { model: 'bisao', unlock: 's8' },
];
