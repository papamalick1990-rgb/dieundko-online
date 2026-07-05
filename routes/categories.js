const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// GET /api/categories — liste publique
router.get('/', (req, res) => {
  const data = db.readOnly();
  res.json(data.categories);
});

// POST /api/admin/categories — ajout (protégé)
router.post('/', requireAdmin, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Le nom de la catégorie est requis.' });

  const result = await db.transaction((data) => {
    if (data.categories.includes(name)) return 'DUPLICATE';
    data.categories.push(name);
    return 'OK';
  });

  if (result === 'DUPLICATE') return res.status(409).json({ error: 'Cette catégorie existe déjà.' });
  res.status(201).json({ ok: true });
});

// DELETE /api/admin/categories/:name — suppression (protégé)
router.delete('/:name', requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const result = await db.transaction((data) => {
    const inUse = data.products.some(p => p.category === name);
    if (inUse) return 'IN_USE';
    data.categories = data.categories.filter(c => c !== name);
    return 'OK';
  });

  if (result === 'IN_USE') return res.status(409).json({ error: 'Des produits utilisent encore cette catégorie.' });
  res.json({ ok: true });
});

module.exports = router;
