// db.js — Petite base de données basée sur un fichier JSON.
// Choix volontaire : pas de base de données native (ex. SQLite compilé, PostgreSQL)
// pour que ce projet s'installe et se déploie sans dépendance système supplémentaire,
// sur n'importe quel hébergeur Node.js (Render, Railway, VPS, etc.).
// Pour une boutique de taille modeste, ce système est fiable et largement suffisant.
// Toutes les écritures passent par une file d'attente pour éviter toute corruption
// en cas d'écritures simultanées.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  categories: ['Alimentation', 'Vêtements', 'Électronique', 'Maison', 'Beauté', 'Autre'],
  products: [],
  orders: [],
  customers: [],
  meta: {
    orderCounter: 1000,
  },
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
  }
}

function readRaw() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Fichier de base de données corrompu, réinitialisation.', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

// File d'attente d'écriture simple : garantit qu'une seule écriture a lieu à la fois,
// même si plusieurs requêtes arrivent en même temps.
let writeQueue = Promise.resolve();
function writeRaw(data) {
  writeQueue = writeQueue.then(() => {
    return fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  });
  return writeQueue;
}

// API exposée : transaction(fn) lit les données, laisse fn les modifier, puis sauvegarde.
// Cela évite les lectures/écritures incohérentes entre deux requêtes concurrentes.
let txQueue = Promise.resolve();
function transaction(fn) {
  txQueue = txQueue.then(async () => {
    const data = readRaw();
    const result = await fn(data);
    await writeRaw(data);
    return result;
  });
  return txQueue;
}

function readOnly() {
  return readRaw();
}

module.exports = { transaction, readOnly, ensureDb };
