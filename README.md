# PGRI — Plateforme unifiée de gestion des ressources internes

Madagascar National Parks — DSII. Déplacements de service, salles de réunion, fournitures.

> **État : squelette.** Seule la structure est en place (dossiers, configuration, points d'entrée,
> fichiers de modules et d'entités vides). Aucune logique métier n'est encore écrite.

## Structure

```
PGRI/
├── backend/    API NestJS + TypeORM + PostgreSQL (authentification Active Directory)
├── frontend/   Portail React + TypeScript (Vite), cartographie OpenLayers
└── docs/       Renvois vers le dossier de conception
```

### Backend (`backend/src`)

| Dossier | Rôle |
|---|---|
| `config/` | Lecture des variables d'environnement |
| `database/` | Source de données TypeORM, migrations, données de test |
| `common/` | Énumérations partagées, guards, décorateurs, filtres |
| `modules/auth` | Connexion LDAPS à l'Active Directory, émission du JWT |
| `modules/utilisateurs` | Utilisateur, Role (rôles issus des groupes AD, N+1 issu de `manager`) |
| `modules/ressources` | Ressource abstraite et sous-types : Vehicule, Salle, ArticleStock |
| `modules/chauffeurs` | Chauffeur |
| `modules/demandes` | Socle commun du workflow : Demande, Validation, Commentaire, HistoriqueStatut |
| `modules/deplacements` | DemandeDeplacement, Affectation (validation N+1 puis logistique) |
| `modules/salles` | DemandeSalle (validation logistique, commentaires N+1 / assistante) |
| `modules/fournitures` | DemandeFourniture, LigneFourniture, MouvementStock, BonDeSortie |
| `modules/conflits` | Moteur de détection de conflits (salles, véhicule/chauffeur, stock) |
| `modules/notifications` | E-mails automatiques (SMTP) |
| `modules/cartographie` | Recherche de lieu et estimation de distance |
| `modules/analytique` | Tableau de bord et rapport mensuel |

### Frontend (`frontend/src`)

| Dossier | Rôle |
|---|---|
| `api/` | Client HTTP vers l'API |
| `auth/` | Connexion et contexte de l'utilisateur connecté |
| `routes/` | Définition des routes |
| `layouts/`, `components/` | Mise en page et composants réutilisables |
| `features/` | Un dossier par fonctionnalité (déplacements, salles, fournitures, validations…) |
| `types/` | Types et énumérations partagés avec l'API |

## Démarrage (une fois le développement commencé)

```bash
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

Copier `.env.example` en `.env` dans chaque dossier et renseigner les valeurs.
