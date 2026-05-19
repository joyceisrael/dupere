# Instructions d'installation Supabase pour Les Rachetés du Père

## 🚨 Système de création de compte sécurisé

Ce projet utilise un système de création de compte basé sur des numéros de téléphone autorisés :

### Règles de sécurité :
- Seuls les numéros pré-autorisés peuvent créer des comptes
- Chaque numéro ne peut créer qu'UN SEUL compte
- Si un compte est supprimé, le numéro redevient disponible
- Le code secret doit avoir 4 caractères minimum
- Le nom complet est au choix
- Le rôle (admin/coordinator) est déterminé automatiquement selon le numéro

### ⚠️ Important :
Les numéros autorisés sont configurés directement dans la base de données Supabase et ne doivent PAS être partagés publiquement pour des raisons de sécurité.

## 1. Création du projet Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Choisissez votre organisation
5. Configurez le projet :
   - **Nom du projet**: `les-rachetes-du-pere`
   - **Mot de passe de la base de données**: Générez un mot de passe sécurisé
   - **Région**: Choisissez la région la plus proche de vos utilisateurs
   - **Pricing plan**: Free tier suffisant pour commencer

## 2. Configuration du schéma de base de données

1. Dans votre projet Supabase, allez dans "Table Editor"
2. Cliquez sur le bouton "SQL Editor" dans la barre latérale
3. Copiez et collez le contenu du fichier `supabase-schema.sql`
4. Cliquez sur "Run" pour exécuter le script

## 3. Configuration de l'authentification

1. Allez dans "Authentication" > "Settings"
2. Désactivez "Enable email confirmations" (car nous utilisons un système personnalisé)
3. Dans "Site URL", ajoutez: `http://localhost:8080` (pour le développement)
4. Ajoutez également: `http://localhost:8080/**` dans "Redirect URLs"

## 4. Configuration des clés API

1. Allez dans "Settings" > "API"
2. Notez les informations suivantes :
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: Clé publique
   - **service_role key**: Clé secrète (à ne jamais exposer côté client)

## 5. Variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon-publique
```

## 6. Installation du client Supabase

```bash
npm install @supabase/supabase-js
```

## 7. Intégration dans le projet

Les fichiers suivants sont déjà créés :
- `src/lib/supabase.ts` - Configuration du client Supabase
- `src/lib/supabase-storage.ts` - Logique de stockage avec validation des numéros

## 8. Migration depuis localStorage

Pour migrer les données existantes vers Supabase :

1. Exportez vos données depuis l'application existante
2. Utilisez le SQL Editor pour importer les données
3. Mettez à jour les imports dans votre code :

```typescript
// Remplacer les imports de storage.ts
import { createAccount, loginWith, getUsers, etc. } from '@/lib/supabase-storage'
```

## 9. Configuration de l'authentification par téléphone

1. Allez dans "Authentication" > "Settings"
2. Activez "Enable Phone Signup"
3. Désactivez "Enable email confirmations"
4. Configurez les SMS providers si nécessaire (ou utilisez le mode test)

## 10. Migration des données existantes

Si vous avez des données dans localStorage, vous pouvez les migrer :

1. Utilisez la fonction d'export dans l'application
2. Importez les données via le SQL Editor ou l'API Supabase

## 11. Sécurité (Production)

Pour la production, ajustez les politiques RLS dans le schéma SQL :

- Limitez l'accès selon les rôles utilisateur
- Ajoutez des vérifications d'appartenance aux groupes
- Configurez les permissions fines pour chaque table

## 12. Backup et maintenance

- Activez les backups automatiques dans les paramètres Supabase
- Surveillez l'utilisation de l'espace de stockage
- Mettez en place des alertes pour les performances

## 13. Tables créées

- **users**: Utilisateurs du système (admin, coordinator)
- **authorized_numbers**: Numéros de téléphone autorisés pour créer des comptes
- **persons**: Fidèles/membres de la communauté
- **events**: Événements (activités, cultes, évangélisation)
- **event_participants**: Liaison many-to-many événements-personnes
- **reminders**: Rappels et suivis personnalisés
- **attendances**: Suivi des présences
- **settings**: Paramètres généraux de l'application

## Vues utilitaires

- **event_details**: Vue détaillée des événements avec participants
- **reminder_stats**: Statistiques des rappels avec statuts

Le schéma est maintenant prêt pour être utilisé avec votre application React !
