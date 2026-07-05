require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
db.ensureDb();

const productsRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth-route');

const app = express();
const PORT = process.env.PORT || 3000;

// Nécessaire pour que req.ip fonctionne correctement derrière un proxy d'hébergeur
// (Render, Railway, etc. placent l'app derrière un reverse proxy)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Dossier des images uploadées (servi tel quel)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// --- Routes API ---
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', authRouter);
// Les routes protégées de produits/catégories/commandes sont déjà montées ci-dessus
// (chaque route décide elle-même, via requireAdmin, si l'action nécessite une connexion).

// --- Frontend statique (vitrine + espace vendeur) ---
app.use(express.static(path.join(__dirname, 'public')));

// Petite route de santé, utile pour vérifier que le serveur tourne après déploiement
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Gestion des erreurs multer (upload d'image trop grosse / mauvais format)
app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`\n✅ DIEUNDKO ONLINE — serveur démarré sur le port ${PORT}`);
  console.log(`   Boutique : http://localhost:${PORT}`);
  console.log(`   Espace vendeur : http://localhost:${PORT}/admin.html\n`);
});
