# Les Rachetés du Père

Application de gestion spirituelle pour les coordonnateurs et administrateurs.

## Fonctionnalités

- Gestion des fidèles (personnes)
- Gestion des événements (cultes, activités, évangélisation)
- Système de rappels pour les engagements
- Synchronisation des sessions de rappels
- Export PDF des données
- Gestion des administrateurs (pour les coordonnateurs)
- Notifications in-app et push

## Rôles

- **Coordonnateur** : Peut gérer les administrateurs et accéder à toutes les fonctionnalités
- **Administrateur** : Peut gérer les fidèles, événements et rappels

## Technologies

- React + TypeScript
- Vite
- Supabase (backend)
- TailwindCSS
- shadcn/ui
- Lucide React (icônes)

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` avec les variables Supabase :

```
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
```

## Développement

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Déploiement

Cette application peut être déployée gratuitement sur :
- Vercel (recommandé)
- Netlify
- GitHub Pages
- Cloudflare Pages

## Licence

Propriété de Les Rachetés du Père
