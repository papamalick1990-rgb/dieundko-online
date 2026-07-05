// hash-password.js — Utilitaire en ligne de commande pour générer le hachage
// bcrypt de votre mot de passe vendeur. Ce hachage est ce que vous mettrez
// dans votre fichier .env (variable ADMIN_PASSWORD_HASH) — jamais le mot de
// passe en clair.
//
// Utilisation :
//   node hash-password.js "MonMotDePasseSecret123"
// ou simplement :
//   npm run hash-password -- "MonMotDePasseSecret123"

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.log('\nUtilisation : node hash-password.js "votre_mot_de_passe"\n');
  process.exit(1);
}

if (password.length < 8) {
  console.log('\n⚠️  Attention : choisissez un mot de passe d\'au moins 8 caractères pour plus de sécurité.\n');
}

const hash = bcrypt.hashSync(password, 12);

console.log('\n✅ Hachage généré avec succès. Copiez la ligne ci-dessous dans votre fichier .env :\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
