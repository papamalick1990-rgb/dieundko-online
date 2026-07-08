const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { hashPassword, verifyPassword, issueCustomerToken, requireCustomer } = require('../customerAuth');

const router = express.Router();

function normalizePhone(phone) {
  return (phone || '').replace(/[\s().-]/g, '');
}

// Protection anti-bruteforce simple sur la connexion, par IP (même principe que
// la connexion vendeur).
const rateLimitStore = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
function isRateLimited(ip) {
  const entry = rateLimitStore.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) { rateLimitStore.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}
function recordAttempt(ip) {
  const entry = rateLimitStore.get(ip);
  if (!entry || Date.now() - entry.firstAttempt > WINDOW_MS) rateLimitStore.set(ip, { count: 1, firstAttempt: Date.now() });
  else entry.count += 1;
}

function publicCustomer(customer) {
  return { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address || '' };
}

// POST /api/customers/register
router.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const phone = normalizePhone(req.body.phone);
  const password = req.body.password || '';
  const errors = [];
  if (!name) errors.push('Le nom est requis.');
  if (!phone) errors.push('Le téléphone est requis.');
  if (password.length < 6) errors.push('Le mot de passe doit contenir au moins 6 caractères.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const passwordHash = await hashPassword(password);

  const result = await db.transaction(async (data) => {
    if (!data.customers) data.customers = [];
    if (data.customers.some(c => c.phone === phone)) return { error: 'Un compte existe déjà avec ce numéro.' };
    const customer = {
      id: crypto.randomUUID(), name, phone, passwordHash, address: '',
      createdAt: new Date().toISOString(),
    };
    data.customers.push(customer);
    return { customer };
  });

  if (result.error) return res.status(409).json({ error: result.error });
  const token = issueCustomerToken(result.customer);
  res.status(201).json({ token, customer: publicCustomer(result.customer) });
});

// POST /api/customers/login
router.post('/login', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });

  const phone = normalizePhone(req.body.phone);
  const password = req.body.password || '';
  const data = db.readOnly();
  const customer = (data.customers || []).find(c => c.phone === phone);
  const valid = customer ? await verifyPassword(password, customer.passwordHash) : false;

  if (!valid) { recordAttempt(ip); return res.status(401).json({ error: 'Numéro ou mot de passe incorrect.' }); }

  const token = issueCustomerToken(customer);
  res.json({ token, customer: publicCustomer(customer) });
});

// GET /api/customers/me
router.get('/me', requireCustomer, (req, res) => {
  const data = db.readOnly();
  const customer = (data.customers || []).find(c => c.id === req.customerId);
  if (!customer) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json(publicCustomer(customer));
});

// PUT /api/customers/me — mettre à jour nom / adresse
router.put('/me', requireCustomer, async (req, res) => {
  const name = (req.body.name || '').trim();
  const address = (req.body.address || '').trim();

  const result = await db.transaction((data) => {
    const customer = (data.customers || []).find(c => c.id === req.customerId);
    if (!customer) return null;
    if (name) customer.name = name;
    customer.address = address;
    return customer;
  });

  if (!result) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json(publicCustomer(result));
});

// GET /api/customers/me/orders — historique des commandes du client connecté
router.get('/me/orders', requireCustomer, (req, res) => {
  const data = db.readOnly();
  const orders = (data.orders || []).filter(o => o.customerId === req.customerId);
  res.json(orders.reverse());
});

module.exports = router;
