const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// --- Configuration de l'upload d'images produits ---
// IMPORTANT : les images sont stockées dans data/uploads (et non un dossier "uploads"
// séparé à la racine), car seul le dossier "data" est protégé par le disque persistant
// sur Render. Un site ne peut avoir qu'un seul disque persistant — en rangeant les
// images ici, elles restent protégées sans avoir besoin d'un deuxième disque.
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format d\'image non supporté (jpg, png, webp, gif uniquement).'));
    }
    cb(null, true);
  },
});

function validateProductInput(body) {
  const errors = [];
  const name = (body.name || '').trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const category = (body.category || '').trim();
  const featured = body.featured === 'true' || body.featured === true;

  let promoPrice = null;
  if (body.promoPrice !== undefined && body.promoPrice !== '' && body.promoPrice !== null) {
    promoPrice = Number(body.promoPrice);
    if (Number.isNaN(promoPrice) || promoPrice < 0) {
      errors.push('Le prix promotionnel doit être un nombre positif.');
    } else if (!Number.isNaN(price) && promoPrice >= price) {
      errors.push('Le prix promotionnel doit être inférieur au prix normal.');
    }
  }

  if (!name) errors.push('Le nom est requis.');
  if (Number.isNaN(price) || price < 0) errors.push('Le prix doit être un nombre positif.');
  if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) errors.push('Le stock doit être un entier positif.');
  if (!category) errors.push('La catégorie est requise.');

  return { errors, name, price, stock, category, description: (body.description || '').trim(), featured, promoPrice };
}

// GET /api/products — liste publique
router.get('/', (req, res) => {
  const data = db.readOnly();
  res.json(data.products);
});

// GET /api/products/:id — détail public
router.get('/:id', (req, res) => {
  const data = db.readOnly();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
  res.json(product);
});

// POST /api/admin/products — création (protégé)
router.post('/', requireAdmin, upload.single('imageFile'), async (req, res) => {
  const { errors, name, price, stock, category, description, featured, promoPrice } = validateProductInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  let image = (req.body.imageUrl || '').trim() || null;
  if (req.file) image = '/uploads/' + req.file.filename;

  const result = await db.transaction((data) => {
    if (!data.categories.includes(category)) data.categories.push(category);
    const product = {
      id: crypto.randomUUID(),
      sku: 'SKU-' + (1000 + data.products.length + 1),
      name, description, price, stock, category, image, featured, promoPrice,
      createdAt: new Date().toISOString(),
    };
    data.products.push(product);
    return product;
  });

  res.status(201).json(result);
});

// PUT /api/admin/products/:id — modification (protégé)
router.put('/:id', requireAdmin, upload.single('imageFile'), async (req, res) => {
  const { errors, name, price, stock, category, description, featured, promoPrice } = validateProductInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const result = await db.transaction((data) => {
    const product = data.products.find(p => p.id === req.params.id);
    if (!product) return null;
    if (!data.categories.includes(category)) data.categories.push(category);

    let image = product.image;
    if (req.file) image = '/uploads/' + req.file.filename;
    else if (typeof req.body.imageUrl === 'string') image = req.body.imageUrl.trim() || null;

    Object.assign(product, { name, description, price, stock, category, image, featured, promoPrice });
    return product;
  });

  if (!result) return res.status(404).json({ error: 'Produit introuvable.' });
  res.json(result);
});

// DELETE /api/admin/products/:id — suppression (protégé)
router.delete('/:id', requireAdmin, async (req, res) => {
  const result = await db.transaction((data) => {
    const before = data.products.length;
    data.products = data.products.filter(p => p.id !== req.params.id);
    return data.products.length < before;
  });
  if (!result) return res.status(404).json({ error: 'Produit introuvable.' });
  res.json({ ok: true });
});

module.exports = router;
