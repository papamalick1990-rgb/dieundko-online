const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../auth');
const { optionalCustomer } = require('../customerAuth');
const { notifyNewOrder: notifyWhatsApp } = require('../whatsapp');
const { notifyNewOrder: notifyTelegram } = require('../telegram');

const router = express.Router();

const VALID_STATUSES = ['en_attente', 'traitee', 'annulee'];

function validateOrderInput(body) {
  const errors = [];
  const customerName = (body.customerName || '').trim();
  const phone = (body.phone || '').trim();
  const address = (body.address || '').trim();
  const paymentMethod = (body.paymentMethod || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName) errors.push('Le nom du client est requis.');
  if (!phone) errors.push('Le téléphone est requis.');
  if (!address) errors.push('L\'adresse est requise.');
  if (!paymentMethod) errors.push('Le mode de paiement est requis.');
  if (!items.length) errors.push('Le panier est vide.');

  return { errors, customerName, phone, address, paymentMethod, items };
}

// POST /api/orders — création publique d'une commande (avec vérification serveur du stock)
// optionalCustomer : si le client est connecté, la commande est liée à son compte
// (pour qu'il puisse la suivre) ; sinon la commande fonctionne normalement en invité.
router.post('/', optionalCustomer, async (req, res) => {
  const { errors, customerName, phone, address, paymentMethod, items } = validateOrderInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const result = await db.transaction((data) => {
    const resolvedItems = [];
    for (const it of items) {
      const product = data.products.find(p => p.id === it.productId);
      const qty = Number(it.qty);
      if (!product) return { error: `Article introuvable (id ${it.productId}).` };
      if (!Number.isInteger(qty) || qty <= 0) return { error: `Quantité invalide pour ${product.name}.` };
      if (qty > product.stock) return { error: `Stock insuffisant pour "${product.name}" (${product.stock} disponible(s)).` };
      const effectivePrice = (product.promoPrice != null && product.promoPrice < product.price) ? product.promoPrice : product.price;
      resolvedItems.push({ productId: product.id, name: product.name, price: effectivePrice, qty });
    }

    // Décrément du stock — recalcul du total côté serveur (ne jamais faire confiance au total envoyé par le client)
    let total = 0;
    resolvedItems.forEach(it => {
      const product = data.products.find(p => p.id === it.productId);
      product.stock -= it.qty;
      total += it.price * it.qty;
    });

    data.meta.orderCounter += 1;
    const order = {
      id: crypto.randomUUID(),
      orderNumber: 'CMD-' + data.meta.orderCounter,
      customerId: req.customerId || null,
      customerName, phone, address, paymentMethod,
      items: resolvedItems, total, status: 'en_attente',
      createdAt: new Date().toISOString(),
    };
    data.orders.push(order);
    return { order };
  });

  if (result.error) return res.status(400).json({ error: result.error });
  notifyWhatsApp(result.order); // envoi en arrière-plan, ne bloque jamais la réponse au client
  notifyTelegram(result.order);
  res.status(201).json(result.order);
});

// GET /api/admin/orders — liste des commandes (protégé)
router.get('/', requireAdmin, (req, res) => {
  const data = db.readOnly();
  res.json(data.orders);
});

// PATCH /api/admin/orders/:id — mise à jour du statut (protégé)
router.patch('/:id', requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  const result = await db.transaction((data) => {
    const order = data.orders.find(o => o.id === req.params.id);
    if (!order) return null;
    order.status = status;
    return order;
  });
  if (!result) return res.status(404).json({ error: 'Commande introuvable.' });
  res.json(result);
});

module.exports = router;
