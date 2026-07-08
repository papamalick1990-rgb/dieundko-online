// telegram.js — Envoi d'une notification Telegram au vendeur lors d'une nouvelle commande.
// Utilise l'API officielle des bots Telegram (fiable, gratuite, gérée par Telegram lui-même).
//
// Si TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID ne sont pas configurés, la fonction ne fait
// rien silencieusement (la commande continue de fonctionner normalement).

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function formatOrderMessage(order) {
  const lines = [
    `🛒 *Nouvelle commande ${order.orderNumber}*`,
    `Client : ${order.customerName}`,
    `Téléphone : ${order.phone}`,
    `Adresse : ${order.address}`,
    `Paiement : ${order.paymentMethod}`,
    '',
    ...order.items.map(it => `• ${it.qty}x ${it.name} — ${it.price.toLocaleString('fr-FR')} FCFA`),
    '',
    `*Total : ${order.total.toLocaleString('fr-FR')} FCFA*`,
  ];
  return lines.join('\n');
}

async function notifyNewOrder(order) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; // notifications non configurées, on ignore

  const text = formatOrderMessage(order);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Notification Telegram : réponse non-OK', res.status, body);
    }
  } catch (e) {
    // On ne bloque jamais une commande à cause d'un souci de notification.
    console.error('Notification Telegram : échec de l\'envoi', e.message);
  }
}

module.exports = { notifyNewOrder };
