// customerAuth.js — Authentification des comptes clients (distincte de l'espace
// vendeur : les jetons clients portent role:'customer', ceux du vendeur role:'admin',
// donc un jeton client ne peut jamais donner accès à l'espace vendeur, et inversement).

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '90d'; // les clients restent connectés longtemps, contrairement au vendeur

if (!JWT_SECRET) {
  console.error('\n❌ ERREUR : la variable d\'environnement JWT_SECRET est manquante.\n');
  process.exit(1);
}

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
}
function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
function issueCustomerToken(customer) {
  return jwt.sign({ role: 'customer', customerId: customer.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Exige une connexion client valide (utilisé pour "mes commandes", profil, etc.)
function requireCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Connexion requise.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') throw new Error('rôle invalide');
    req.customerId = payload.customerId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  }
}

// Ne bloque jamais la requête : si un jeton client valide est présent, on sait qui
// commande ; sinon la commande continue en tant qu'invité. Utilisé sur /api/orders.
function optionalCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === 'customer') req.customerId = payload.customerId;
    } catch (e) { /* jeton invalide ou expiré : on continue en tant qu'invité */ }
  }
  next();
}

module.exports = { hashPassword, verifyPassword, issueCustomerToken, requireCustomer, optionalCustomer };
