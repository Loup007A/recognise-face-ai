# 🚀 Guide de Déploiement — FaceID

## Architecture

```
facerecog/
├── backend/          → Node.js/Express  → Railway
├── frontend/         → React/Vite       → Vercel
├── download-models.js  → Script modèles IA
└── package.json
```

---

## Étape 0 — Prérequis

- Compte [GitHub](https://github.com) (gratuit)
- Compte [Railway](https://railway.app) (gratuit, 5 $ de crédit offert)
- Compte [Vercel](https://vercel.com) (gratuit)
- Node.js 18+ installé sur votre machine

---

## Étape 1 — Télécharger les modèles IA (OBLIGATOIRE)

Les modèles TensorFlow/face-api.js doivent être dans `frontend/public/models/`.

```bash
# Depuis la racine du projet
node download-models.js
```

Vous devriez voir apparaître dans `frontend/public/models/` :
- `tiny_face_detector_model-*`
- `face_landmark_68_model-*`
- `face_recognition_model-*`
- `face_expression_recognition_model-*`

> ⚠️ Ces fichiers pèsent ~6 Mo au total. Ils doivent être committé dans Git pour Vercel.

---

## Étape 2 — Pousser sur GitHub

```bash
cd /chemin/vers/facerecog
git init
git add .
git commit -m "feat: initial commit — FaceID system"

# Sur GitHub, créez un nouveau dépôt vide nommé "facerecog"
git remote add origin https://github.com/VOTRE_USERNAME/facerecog.git
git branch -M main
git push -u origin main
```

---

## Étape 3 — Déployer le Backend sur Railway

### 3.1 — Créer un projet Railway

1. Allez sur [railway.app](https://railway.app) → **New Project**
2. Choisissez **Deploy from GitHub repo**
3. Sélectionnez votre dépôt `facerecog`
4. Railway détecte automatiquement le `backend/` → cliquez **Deploy**

> Si Railway déploie la racine au lieu de `backend/`, allez dans **Settings → Build** et définissez :
> - **Root Directory** : `backend`

### 3.2 — Ajouter PostgreSQL

1. Dans votre projet Railway → **New** → **Database** → **PostgreSQL**
2. Railway crée automatiquement la variable `DATABASE_URL`
3. Celle-ci est automatiquement injectée dans votre service backend

### 3.3 — Variables d'environnement Backend

Dans Railway → votre service backend → **Variables** → ajoutez :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://VOTRE-APP.vercel.app` *(à remplir après étape 4)* |

> `DATABASE_URL` et `PORT` sont automatiquement gérés par Railway.

### 3.4 — Build & Start commands

Railway les détecte depuis `railway.toml`, mais vérifiez dans **Settings** :

- **Build Command** : `npm install && npm run migrate`
- **Start Command** : `npm start`

### 3.5 — Récupérer l'URL du backend

Une fois déployé, Railway vous donne une URL du type :
```
https://facerecog-backend-production.up.railway.app
```
**Notez-la**, vous en aurez besoin à l'étape 4.

---

## Étape 4 — Déployer le Frontend sur Vercel

### 4.1 — Importer le projet

1. Allez sur [vercel.com](https://vercel.com) → **New Project**
2. Importez votre dépôt GitHub `facerecog`
3. Vercel demande la configuration :

| Champ | Valeur |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 4.2 — Variables d'environnement Frontend

Dans Vercel → **Environment Variables** → ajoutez :

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `https://facerecog-backend-production.up.railway.app` |

> ⚠️ Remplacez par l'URL exacte obtenue à l'étape 3.5

### 4.3 — Déployer

Cliquez **Deploy**. Vercel construit et déploie votre frontend (~2 min).

Vous obtenez une URL du type :
```
https://facerecog.vercel.app
```

---

## Étape 5 — Mettre à jour CORS sur le Backend

Retournez sur Railway → Variables → mettez à jour :

```
ALLOWED_ORIGINS=https://facerecog.vercel.app
```

Railway redéploie automatiquement.

---

## Étape 6 — Vérification finale

Visitez votre URL Vercel. Le flux complet doit fonctionner :

1. ✅ Modal CGU s'affiche
2. ✅ Après acceptation, bouton "Activer la caméra"
3. ✅ Les modèles IA se chargent (~3-5 sec première fois)
4. ✅ La caméra s'active, les landmarks s'affichent
5. ✅ Après analyse, soit identification soit formulaire d'enregistrement

---

## Résumé des commandes

| Commande | Description |
|---|---|
| `node download-models.js` | Télécharge les modèles IA |
| `git push origin main` | Déclenche le redéploiement auto |
| `cd backend && npm run migrate` | Rejoue les migrations SQL |

---

## Variables d'environnement — Récapitulatif

### Backend (Railway)
```env
NODE_ENV=production
DATABASE_URL=<automatique Railway>
PORT=<automatique Railway>
ALLOWED_ORIGINS=https://votre-app.vercel.app
```

### Frontend (Vercel)
```env
VITE_API_URL=https://votre-backend.up.railway.app
```

---

## Dépannage

### La caméra ne s'active pas
- Vérifiez que le site est en **HTTPS** (obligatoire pour getUserMedia)
- Vercel et Railway fournissent HTTPS automatiquement ✅

### Erreur CORS
- Vérifiez que `ALLOWED_ORIGINS` sur Railway contient exactement votre URL Vercel
- Pas de slash final : `https://app.vercel.app` ✅ / `https://app.vercel.app/` ❌

### Les modèles ne chargent pas
- Vérifiez que `frontend/public/models/` contient bien les 9 fichiers
- Ils doivent être dans le commit Git (pas dans `.gitignore`)

### Erreur de base de données
- Vérifiez dans Railway que le service PostgreSQL est bien lié au service backend
- Cliquez sur le service PostgreSQL → **Connect** → vérifiez que `DATABASE_URL` est partagée

### Migration non exécutée
- Dans Railway → votre service → **Deployments** → cliquez sur le dernier déploiement
- Vérifiez les logs de build pour `✅ Migrations completed`
- Si absent : allez dans **Settings → Build Command** → vérifiez `npm install && npm run migrate`

---

## Conformité RGPD

Ce système collecte des **données biométriques** (catégorie spéciale, Art. 9 RGPD).

Points de conformité implémentés :
- ✅ Consentement explicite avec triple case à cocher
- ✅ Information claire sur les données collectées
- ✅ Droit à l'effacement (endpoint DELETE)
- ✅ Aucune image stockée (uniquement descripteur mathématique)
- ✅ Limitation de la finalité (reconnaissance uniquement)
- ✅ Minimum d'âge (13 ans)

> ⚠️ **Pour une mise en production réelle**, consultez un DPO (Délégué à la Protection des Données) et enregistrez votre traitement auprès de la CNIL : [cnil.fr](https://www.cnil.fr)

---

## Coûts estimés

| Service | Plan gratuit |
|---|---|
| Railway | 5 $ offerts, puis ~5$/mois |
| Vercel | Gratuit (Hobby plan) |
| PostgreSQL (Railway) | Inclus dans Railway |

**Total : gratuit pour un usage de démonstration.**
