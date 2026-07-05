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
  uploads/            → images des produits importées depuis l'espace vendeur
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

## 5. Produits phares et promotions

Dans l'espace vendeur, chaque produit peut être marqué comme :
- **"Produit phare"** (case à cocher) → il apparaît dans la section "★ Produits phares" sur la page d'accueil
- **En promotion** (champ "Prix promotionnel") → il apparaît dans la section "🔥 En promotion" avec le prix barré et le pourcentage de réduction affiché automatiquement

Ces deux sections n'apparaissent sur la page d'accueil que s'il y a au moins un produit correspondant — sinon elles restent invisibles pour ne pas laisser un espace vide. Le prix promotionnel est aussi celui utilisé pour calculer le total réel d'une commande (le client paie bien le prix affiché).

## 6. Limites connues

- Pas de paiement en ligne réel intégré (le client choisit "paiement à la
  livraison", Wave ou Orange Money, et vous le contactez pour finaliser) —
  une vraie intégration Wave/Orange Money est possible mais demande un
  compte marchand et des clés API auprès d'eux
- La base de données est un simple fichier JSON : parfait pour une boutique
  de taille modeste, mais si votre activité grandit beaucoup, il faudra
  migrer vers une vraie base de données (PostgreSQL, par exemple)
