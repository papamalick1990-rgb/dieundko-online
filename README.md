# DIEUNDKO ONLINE — Backend

Site e-commerce complet avec un vrai serveur : base de données côté serveur,
authentification sécurisée (mot de passe haché + session), et une API que
la boutique et l'espace vendeur utilisent tous les deux.

## Ce que contient ce projet

```
dieundko-backend/
  server.js           → point d'entrée du serveur
  db.js               → petite base de données (fichier JSON, pas de dépendance externe)
  auth.js             → vérification du mot de passe + gestion des sessions (JWT)
  hash-password.js    → outil pour générer le hachage de votre mot de passe
  routes/             → les routes de l'API (produits, catégories, commandes, connexion)
  public/             → le site (vitrine + espace vendeur), servi par le serveur
  data/uploads/       → images des produits importées depuis l'espace vendeur (protégées par le disque persistant, voir section 2)
  .env.example        → modèle du fichier de configuration secrète
```

## 1. Installation en local (pour tester avant de mettre en ligne)

Il vous faut [Node.js](https://nodejs.org) installé (version 18 ou plus récente).

```bash
cd dieundko-backend
npm install
```

### Configurer vos secrets

Copiez `.env.example` en `.env` :

```bash
cp .env.example .env
```

Générez le hachage de votre mot de passe vendeur (remplacez par le mot de passe de votre choix) :

```bash
npm run hash-password -- "VotreMotDePasseSecret"
```

Cela affiche une ligne comme :
```
ADMIN_PASSWORD_HASH=$2a$12$abcdefghijklmnopqrstuv...
```
Copiez-la dans votre fichier `.env` (remplacez la ligne existante).

Générez aussi une clé secrète aléatoire pour `JWT_SECRET` :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copiez le résultat dans `.env` à la place de `JWT_SECRET=...`.

### Démarrer le serveur

```bash
npm start
```

Le site est accessible sur **http://localhost:3000**
L'espace vendeur est sur **http://localhost:3000/admin.html**

## 2. Mettre le site en ligne (hébergement)

Ce projet est un serveur Node.js classique — il peut être hébergé sur n'importe
quel service qui exécute du Node.js. Voici deux options gratuites pour démarrer :

### Option A — Render.com (recommandé, gratuit pour commencer)

1. Créez un compte sur [render.com](https://render.com)
2. Mettez ce dossier dans un dépôt GitHub (ou utilisez leur import direct)
3. Sur Render : **New +** → **Web Service** → connectez votre dépôt
4. Réglages :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
5. Dans l'onglet **Environment**, ajoutez vos variables (les mêmes que dans `.env`) :
   - `JWT_SECRET`
   - `ADMIN_PASSWORD_HASH`
6. Déployez. Render vous donne une adresse du type `https://dieundko-online.onrender.com`

⚠️ Important : sur le plan gratuit de Render, le disque n'est pas garanti permanent
entre les redémarrages. Pour un usage sérieux, prenez une petite option payante
avec disque persistant, ou passez à l'option B.

**Disque persistant (obligatoire pour ne pas perdre vos données) :**
Render ne permet qu'**un seul** disque persistant par site — c'est pourquoi ce
projet range à la fois la base de données (`data/db.json`) et les images
importées (`data/uploads/`) dans le **même dossier `data`**. Un seul disque
suffit donc pour protéger les deux.

1. Sur la page de votre service → onglet **Disks** → **Add Disk**
2. **Mount Path** : `/opt/render/project/src/data`
3. **Size** : 1 GB suffit pour commencer

Si un jour vous voyez le mount path pointer ailleurs (par exemple sur un
ancien dossier `uploads` séparé), corrigez-le vers `.../src/data` — sinon vos
photos de produits disparaîtront à chaque redéploiement.

### Option B — Railway.app

Même principe que Render : connectez votre dépôt GitHub, ajoutez les variables
d'environnement (`JWT_SECRET`, `ADMIN_PASSWORD_HASH`), et Railway détecte
automatiquement qu'il s'agit d'un projet Node.js.

### Option C — Un VPS (serveur privé), pour plus de contrôle

Si vous avez un petit serveur (par exemple chez OVH, Contabo, DigitalOcean) :
1. Installez Node.js sur le serveur
2. Copiez ce dossier sur le serveur (via `git clone` ou `scp`)
3. Suivez les étapes d'installation en local ci-dessus
4. Utilisez un gestionnaire de processus comme [pm2](https://pm2.keymetrics.io/)
   pour garder le serveur actif en permanence :
   ```bash
   npm install -g pm2
   pm2 start server.js --name dieundko
   pm2 save
   ```
5. Utilisez un nom de domaine + [Nginx](https://nginx.org) en reverse proxy
   pour servir le site en HTTPS (ou Caddy, plus simple à configurer pour HTTPS automatique)

## 3. Sécurité — ce qui est déjà fait, et ce qu'il faut faire vous-même

**Déjà en place dans le code :**
- Le mot de passe vendeur n'est jamais stocké en clair (hachage bcrypt)
- Les actions de gestion (ajouter/modifier/supprimer un produit, voir les
  commandes, changer un statut) exigent un jeton de session valide
- Le total et le stock des commandes sont toujours recalculés et vérifiés
  **côté serveur** — un client malveillant ne peut pas falsifier un prix
  ou commander plus que le stock disponible
- Protection basique contre les tentatives de mot de passe en rafale (5 essais / 10 min)

**À faire vous-même :**
- Ne partagez jamais votre fichier `.env` ni son contenu
- Une fois en ligne, utilisez toujours l'adresse en **https://** (la plupart
  des hébergeurs comme Render/Railway l'activent automatiquement)
- Faites des sauvegardes régulières du fichier `data/db.json` (vos produits
  et commandes) — copiez-le de temps en temps sur votre ordinateur
- Si vous soupçonnez que votre mot de passe a fuité, changez-le tout de
  suite (regénérez un hachage et mettez à jour `ADMIN_PASSWORD_HASH`)

## 4. Comment accéder à l'espace vendeur

Allez directement sur `/admin.html` (par exemple `https://votresite.com/admin.html`).
Ce lien n'apparaît nulle part sur la boutique publique.

## 5. Notifications à chaque nouvelle commande

Vous pouvez recevoir un message automatique dès qu'un client passe une
commande. Deux options sont disponibles, vous pouvez activer l'une, l'autre,
ou les deux.

### Option recommandée — Telegram (fiable, officielle, gratuite)

1. Installez [Telegram](https://telegram.org) (gratuit)
2. Cherchez le contact `@BotFather`, envoyez `/newbot`, suivez les instructions
   (nom du bot, puis un nom d'utilisateur se terminant par "bot")
3. BotFather vous donne un **token** — copiez-le
4. Cherchez votre nouveau bot par son nom d'utilisateur, ouvrez la conversation,
   cliquez **"Démarrer"** (les bots ne peuvent pas écrire en premier)
5. Cherchez le contact `@userinfobot`, envoyez-lui un message : il répond
   immédiatement avec votre identifiant ("Id: 123456789")
6. Ajoutez ces variables d'environnement :
   - `TELEGRAM_BOT_TOKEN` → le token de l'étape 3
   - `TELEGRAM_CHAT_ID` → l'identifiant de l'étape 5

### Option alternative — WhatsApp via CallMeBot (gratuite mais parfois capricieuse)

Ce service tiers non-officiel envoie uniquement vers **votre propre numéro**
(pas vers vos clients). Il peut mettre du temps à répondre, ou nécessiter
plusieurs essais.

1. Sur WhatsApp, ajoutez le contact indiqué sur [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/)
   (le numéro change de temps en temps, vérifiez sur leur site)
2. Envoyez-lui exactement : `I allow callmebot to send me messages`
3. Vous recevrez une réponse contenant votre clé API
4. Ajoutez ces variables d'environnement :
   - `WHATSAPP_PHONE` → votre numéro avec l'indicatif pays, ex. `+221771234567`
   - `WHATSAPP_APIKEY` → la clé reçue

### Activer les notifications

Ajoutez les variables choisies sur Render (**Environment** → **Add Environment
Variable**), puis redéployez. Si aucune de ces variables n'est définie, le
site fonctionne normalement, simplement sans notification.

## 6. Comptes clients

Les clients peuvent créer un compte (nom, téléphone, mot de passe) via le
bouton **"Mon compte"** sur la boutique. Un compte n'est **jamais obligatoire**
pour commander — la commande "invité" (sans compte) reste toujours possible.

Ce que ça change pour le client connecté :
- Son nom, téléphone et adresse sont pré-remplis à la commande
- Il peut consulter l'historique et le **statut** de toutes ses commandes
  passées (bouton "Mon compte" → liste des commandes)

Ce que ça change pour vous :
- Rien à faire — chaque commande passée par un client connecté est
  automatiquement liée à son compte, en plus d'apparaître normalement dans
  votre espace vendeur
- Un client ne peut voir que **ses propres** commandes, jamais celles des autres

## 7. Produits phares et promotions

Dans l'espace vendeur, chaque produit peut être marqué comme :
- **"Produit phare"** (case à cocher) → il apparaît dans la section "★ Produits phares" sur la page d'accueil
- **En promotion** (champ "Prix promotionnel") → il apparaît dans la section "🔥 En promotion" avec le prix barré et le pourcentage de réduction affiché automatiquement

Ces deux sections n'apparaissent sur la page d'accueil que s'il y a au moins un produit correspondant — sinon elles restent invisibles pour ne pas laisser un espace vide. Le prix promotionnel est aussi celui utilisé pour calculer le total réel d'une commande (le client paie bien le prix affiché).

## 8. Limites connues

- Pas de paiement en ligne réel intégré (le client choisit "paiement à la
  livraison", Wave ou Orange Money, et vous le contactez pour finaliser) —
  une vraie intégration Wave/Orange Money est possible mais demande un
  compte marchand et des clés API auprès d'eux
- La base de données est un simple fichier JSON : parfait pour une boutique
  de taille modeste, mais si votre activité grandit beaucoup, il faudra
  migrer vers une vraie base de données (PostgreSQL, par exemple)
