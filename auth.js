// auth.js — Authentification de l'espace vendeur.
// Le mot de passe n'est JAMAIS stocké ni comparé en clair : on stocke un hachage
// bcrypt (à sens unique, impossible à retrouver) et on compare avec bcrypt.compare.
// Une session valide est représentée par un jeton JWT signé côté serveur,
// que le navigateur renvoie ensuite dans l'en-tête Authorization.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const TOKEN_TTL = '12h';

if (!JWT_SECRET) {
  console.error('\n❌ ERREUR : la variable d\'environnement JWT_SECRET est manquante.');
  console.error('Créez un fichier .env (voir .env.example) avant de démarrer le serveur.\n');
  process.exit(1);
}
if (!ADMIN_PASSWORD_HASH) {
  console.error('\n❌ ERREUR : la variable d\'environnement ADMIN_PASSWORD_HASH est manquante.');
  console.error('Générez-la avec : npm run hash-password\n');
  process.exit(1);
}

async function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, ADMIN_PASSWORD_HASH);
}

function issueToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('rôle invalide');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' });
  }
}

module.exports = { verifyPassword, issueToken, requireAdmin };
