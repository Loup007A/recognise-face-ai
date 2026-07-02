# 🚀 Guide de Déploiement — FaceID Multi-biométrique

## Architecture

```
facerecog/
├── backend/          → Node.js/Express + better-sqlite3 (fichier local)
│   ├── server.js     → Routes visage + orchestration
│   ├── db.js          → Connexion + schéma SQLite
│   ├── webauthn.js    → Routes empreinte digitale (Touch ID / Windows Hello)
│   ├── voice.js       → Routes empreinte vocale
│   └── migrate.js
├── frontend/          → React/Vite
│   ├── components/
│   │   ├── FaceCamera.jsx        → Reconnaissance faciale
│   │   ├── VoiceRecognition.jsx  → Empreinte vocale + commande vocale
│   │   ├── FingerprintAuth.jsx   → WebAuthn (empreinte digitale)
│   │   ├── MethodSelector.jsx    → Sélecteur des 3 méthodes
│   │   └── EnrollExtraModal.jsx  → Propose voix/empreinte après inscription visage
├── download-models.js
└── render.yaml
```

### Pourquoi SQLite et pas PostgreSQL ?

`better-sqlite3` stocke tout dans un **seul fichier** (`facerecog.db`) sur le disque du serveur.
Plus simple, plus rapide pour ce volume de données, mais **nécessite un disque persistant**
sur Render (sinon le fichier est supprimé à chaque redéploiement).

### Comment fonctionne l'empreinte digitale ?

Le navigateur n'a **jamais accès** au capteur d'empreinte physique de l'appareil — c'est une
restriction de sécurité d'Apple/Google/Microsoft. La seule solution standard est **WebAuthn** :

1. Le site demande à l'appareil de vérifier l'utilisateur (Touch ID, Face ID, Windows Hello, clé USB...)
2. L'appareil fait la vérification **localement**, jamais l'empreinte elle-même n'est transmise
3. L'appareil renvoie une signature cryptographique unique, stockée côté serveur
4. Lors d'une connexion suivante, l'appareil resigne un nouveau challenge — le serveur vérifie la signature

C'est plus sécurisé qu'un mot de passe et **standard de l'industrie** (utilisé par Apple, Google, banques...).

### Comment fonctionne l'empreinte vocale ?

Le navigateur enregistre 2,5 secondes d'audio via l'API Web Audio, puis calcule un vecteur de
32 valeurs représentant l'énergie du signal dans différentes bandes de fréquences (une version
simplifiée du MFCC utilisé en reconnaissance vocale professionnelle). Ce vecteur est comparé
à ceux stockés en base par distance euclidienne — comme pour le visage.

> ⚠️ Note honnêteté : ce n'est **pas** un système de reconnaissance vocale de niveau production
> (type Amazon/Google), mais une démonstration fonctionnelle suffisante pour distinguer des voix
> différentes dans un cadre de démo.

---

## Étape 0 — Prérequis

- Compte [GitHub](https://github.com)
- Compte [Render](https://render.com) (gratuit)
- Node.js 18+ en local (uniquement pour télécharger les modèles IA une fois)

---

## Étape 1 — Télécharger les modèles IA faciaux

```bash
node download-models.js
```

Vérifiez que `frontend/public/models/` contient bien 9 fichiers.

---

## Étape 2 — Pousser sur GitHub

```bash
git add .
git commit -m "feat: ajout voix + empreinte digitale, migration SQLite"
git push origin main
```

---

## Étape 3 — Backend sur Render

### 3.1 — Créer le service Web

1. Render Dashboard → **New +** → **Web Service**
2. Connectez votre repo GitHub
3. Configuration :

| Champ | Valeur |
|---|---|
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |

> ⚠️ **N'ajoutez PAS `&& npm run migrate` à la Build Command.** Le disque persistant
> (configuré à l'étape 3.2) n'est monté qu'au **démarrage** du service, pas pendant le build.
> Si la migration tourne en phase de build, `/var/data` n'existe pas encore et `mkdir` échoue.
> Ce n'est pas un problème : `server.js` exécute déjà la migration automatiquement à chaque
> démarrage (`runMigrate()` est appelé avant `app.listen()`), donc `npm start` suffit.

> ℹ️ Le projet épingle Node.js 20 LTS (via `engines` dans `package.json` et `.nvmrc`) **et**
> `better-sqlite3` à `~12.9.0` précisément. Ce n'est pas arbitraire : à partir de la v12.10.0,
> les mainteneurs de better-sqlite3 ont retiré les binaires précompilés pour Node 20 (EOL côté
> Node.js), ce qui forcerait une compilation native sur Render — exactement la panne déjà rencontrée
> avec PostgreSQL/Node 26. **Ne changez pas ce pin sans vérifier la matrice de compatibilité**
> sur https://github.com/WiseLibs/better-sqlite3/releases.
>
> Si malgré tout le build échoue à la compilation de `better-sqlite3`, vérifiez en premier lieu
> que la variable d'environnement `NODE_VERSION=20.18.1` est bien définie dans
> **Settings → Environment** sur Render (parfois ignorée si `render.yaml` n'est pas utilisé via Blueprint).
| **Start Command** | `npm start` |

### 3.2 — ⚠️ Ajouter un disque persistant (OBLIGATOIRE)

Sans ça, votre base de données sera **effacée à chaque redéploiement**.

1. Dans votre service → **Disks** → **Add Disk**
2. Configuration :

| Champ | Valeur |
|---|---|
| **Name** | `facerecog-data` |
| **Mount Path** | `/var/data` |
| **Size** | 1 GB (largement suffisant) |

### 3.3 — Variables d'environnement

Toujours dans votre service → **Environment** :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `SQLITE_DATA_DIR` | `/var/data` |
| `ALLOWED_ORIGINS` | `https://votre-frontend.onrender.com` *(à remplir après étape 4)* |
| `WEBAUTHN_RP_ID` | `votre-frontend.onrender.com` *(SANS https://, sans port)* |
| `WEBAUTHN_ORIGIN` | `https://votre-frontend.onrender.com` |

> Si vous avez un `render.yaml` à la racine du repo, Render peut détecter cette config
> automatiquement via **New + → Blueprint** au lieu de configurer manuellement.

### 3.4 — Déployer et récupérer l'URL

Cliquez **Create Web Service**. Notez l'URL obtenue, ex :
```
https://facerecog-backend.onrender.com
```

---

## Étape 4 — Frontend sur Render (Static Site)

### 4.1 — Créer le Static Site

1. **New +** → **Static Site**
2. Connectez le même repo

| Champ | Valeur |
|---|---|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 4.2 — Variable d'environnement

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `https://facerecog-backend.onrender.com` *(URL de l'étape 3.4)* |

### 4.3 — Règle de rewrite SPA

**Redirects/Rewrites** → **Add Rule** :

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

### 4.4 — Déployer

Notez l'URL obtenue, ex : `https://facerecog-frontend.onrender.com`

---

## Étape 5 — Boucler les variables croisées

Retournez sur le **backend** → Environment → mettez à jour avec l'URL exacte du frontend :

```
ALLOWED_ORIGINS=https://facerecog-frontend.onrender.com
WEBAUTHN_RP_ID=facerecog-frontend.onrender.com
WEBAUTHN_ORIGIN=https://facerecog-frontend.onrender.com
```

Render redéploie automatiquement.

---

## Étape 6 — Vérification finale

1. ✅ Modal CGU (mentionne désormais visage + voix + empreinte)
2. ✅ Sélecteur de 3 méthodes en haut de page
3. ✅ **Visage** : caméra → landmarks → reconnaissance ou inscription
4. ✅ Après inscription faciale → popup propose d'ajouter voix/empreinte
5. ✅ **Voix** : bouton micro → 2,5s d'enregistrement → identification
6. ✅ **Empreinte** : bouton → popup natif Touch ID/Windows Hello → identification

---

## Dépannage spécifique

### "La base de données est vide après redéploiement"
→ Le disque persistant n'est pas configuré, ou `SQLITE_DATA_DIR` ne correspond pas au `mountPath`.

### WebAuthn : "Erreur lors de l'enregistrement biométrique"
- Vérifiez que `WEBAUTHN_RP_ID` est **exactement** le domaine du frontend, sans `https://` ni port
- Le navigateur doit être en **HTTPS** (Render le fournit automatiquement)
- L'appareil doit avoir Touch ID / Face ID / Windows Hello configuré au niveau OS

### "Votre navigateur ne supporte pas WebAuthn"
- Safari < 14, Firefox < 60, ou navigateur sans capteur biométrique configuré
- Fonctionne sur : Chrome, Edge, Safari récents, sur ordinateur avec webcam Windows Hello ou Mac avec Touch ID, et sur mobile (empreinte/Face ID)

### Micro non détecté
- Vérifiez que le site est en HTTPS
- Vérifiez les permissions du navigateur (icône cadenas dans la barre d'adresse)

### Erreur CORS
- `ALLOWED_ORIGINS` sur le backend doit correspondre exactement à l'URL du frontend, sans slash final

---

## Conformité RGPD — mise à jour

Avec l'ajout de la voix et de l'empreinte digitale, le périmètre des données sensibles
(Art. 9 RGPD) s'élargit :

| Donnée | Stockée ? | Quitte l'appareil ? |
|---|---|---|
| Image du visage | ❌ Non | ❌ Jamais |
| Descripteur facial (128 valeurs) | ✅ Oui | ✅ Oui (vecteur mathématique) |
| Enregistrement audio brut | ❌ Non | ❌ Jamais |
| Empreinte vocale (32 valeurs) | ✅ Oui | ✅ Oui (vecteur mathématique) |
| Empreinte digitale réelle | ❌ Non | ❌ **Jamais** (reste sur l'appareil) |
| Clé publique WebAuthn | ✅ Oui | ✅ Oui (donnée non sensible, inutilisable seule) |

Le consentement (`ConsentModal.jsx`) couvre désormais les 3 méthodes. Chaque méthode
additionnelle (voix, empreinte) est **optionnelle** — uniquement proposée après inscription faciale.

> ⚠️ Pour une mise en production réelle, consultez un DPO et déclarez votre traitement à la CNIL.

---

## Coûts

| Service | Plan |
|---|---|
| Render Web Service (backend) | Gratuit (avec limitations de mise en veille) ou Starter 7$/mois pour disponibilité continue |
| Render Disk 1GB | ~0,25$/mois |
| Render Static Site (frontend) | Gratuit |

**Total : gratuit à quelques dollars/mois.**
