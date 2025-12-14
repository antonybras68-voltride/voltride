# ⚡ VOLTRIDE - Sistema de Gestión de Alquileres

Application de gestion de location de vélos et scooters pour Voltride.

## 🚀 Fonctionnalités

- ✅ Gestion des véhicules (vélos, e-bikes, scooters)
- ✅ Gestion des clients
- ✅ Gestion des locations avec contrats
- ✅ Caisse avec rapport Z
- ✅ Multi-agences (AG-01 Torrevieja, AG-02 Centro)
- ✅ Multilingue (Español, Français, English)
- ✅ Gestion des utilisateurs (admin/employé)

## 📋 Prérequis

- Node.js 18 ou supérieur
- PostgreSQL

## 🔧 Installation locale

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Configurer DATABASE_URL dans .env

# Démarrer l'application
npm start
```

## ☁️ Déploiement sur Railway

### Méthode 1 : Depuis GitHub (Recommandé)

1. Créer un compte sur [Railway](https://railway.app)
2. Connecter votre compte GitHub
3. Créer un nouveau projet depuis ce repository
4. Ajouter un service PostgreSQL
5. Railway configure automatiquement DATABASE_URL

### Méthode 2 : Upload direct

1. Créer un compte sur [Railway](https://railway.app)
2. Créer un nouveau projet vide
3. Ajouter un service PostgreSQL
4. Déployer depuis le CLI Railway

## 🔐 Connexion par défaut

- **Usuario:** admin
- **Contraseña:** admin123

⚠️ **IMPORTANT:** Changez le mot de passe admin après le premier déploiement!

## 📁 Structure du projet

```
voltride/
├── backend/
│   ├── server.js          # Serveur Express
│   ├── database.js        # Configuration PostgreSQL
│   └── routes/            # API REST
│       ├── auth.js        # Authentification
│       ├── vehicles.js    # Véhicules
│       ├── customers.js   # Clients
│       ├── rentals.js     # Locations
│       ├── payments.js    # Paiements
│       ├── agencies.js    # Agences
│       └── reports.js     # Rapports
├── frontend/
│   ├── index.html         # Page de connexion
│   ├── app.html           # Application principale
│   ├── css/styles.css     # Styles
│   └── js/
│       ├── translations.js # Traductions
│       ├── api.js         # Module API
│       └── app.js         # Logique principale
├── package.json
├── Procfile
└── railway.json
```

## 💰 Calcul des prix

Les prix sont calculés par périodes de 24 heures avec 1 heure de tolérance:
- 0-25h = 1 jour
- 25-49h = 2 jours
- etc.

## 🛠️ Technologies utilisées

- **Backend:** Node.js, Express
- **Base de données:** PostgreSQL
- **Frontend:** HTML, CSS, JavaScript vanilla
- **Authentification:** JWT

## 📞 Support

Pour toute question, contactez Voltride.

---
© 2024 Voltride - Torrevieja, España
