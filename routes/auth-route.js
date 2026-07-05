const express = require('express');
const rateLimitStore = new Map(); // simple limiteur anti-bruteforce en mémoire, par IP
const { verifyPassword, issueToken } = require('../auth');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(ip) {
  const entry = rateLimitStore.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}
function recordAttempt(ip) {
  const entry = rateLimitStore.get(ip);
  if (!entry || Date.now() - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count += 1;
  }
}
function clearAttempts(ip) {
  rateLimitStore.delete(ip);
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }

  const password = req.body.password || '';
  const valid = await verifyPassword(password);

  if (!valid) {
    recordAttempt(ip);
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  clearAttempts(ip);
  const token = issueToken();
  res.json({ token });
});

module.exports = router;
