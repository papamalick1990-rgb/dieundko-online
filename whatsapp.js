// whatsapp.js — Envoi d'une notification WhatsApp au vendeur lors d'une nouvelle commande,
// via l'API gratuite CallMeBot (https://www.callmebot.com). Ce service envoie un message
// vers UN SEUL numéro (le vôtre) — ce n'est pas fait pour contacter vos clients, seulement
// pour vous prévenir vous-même.
//
// Si les variables WHATSAPP_PHONE / WHATSAPP_APIKEY ne sont pas configurées, la fonction
// ne fait rien silencieusement (la commande continue de fonctionner normalement).

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;
const WHATSAPP_APIKEY = process.env.WHATSAPP_APIKEY;

function formatOrderMessage(order) {
  const lines = [
    `🛒 Nouvelle commande ${order.orderNumber}`,
    `Client : ${order.customerName}`,
    `Téléphone : ${order.phone}`,
    `Adresse : ${order.address}`,
    `Paiement : ${order.paymentMethod}`,
    '',
    ...order.items.map(it => `• ${it.qty}x ${it.name} — ${it.price.toLocaleString('fr-FR')} FCFA`),
    '',
    `Total : ${order.total.toLocaleString('fr-FR')} FCFA`,
  ];
  return lines.join('\n');
}

async function notifyNewOrder(order) {
  if (!WHATSAPP_PHONE || !WHATSAPP_APIKEY) return; // notifications non configurées, on ignore

  const text = formatOrderMessage(order);
  const url = 'https://api.callmebot.com/whatsapp.php'
    + '?phone=' + encodeURIComponent(WHATSAPP_PHONE)
    + '&apikey=' + encodeURIComponent(WHATSAPP_APIKEY)
    + '&text=' + encodeURIComponent(text);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Notification WhatsApp : réponse non-OK de CallMeBot', res.status);
    }
  } catch (e) {
    // On ne bloque jamais une commande à cause d'un souci de notification.
    console.error('Notification WhatsApp : échec de l\'envoi', e.message);
  }
}

module.exports = { notifyNewOrder };
