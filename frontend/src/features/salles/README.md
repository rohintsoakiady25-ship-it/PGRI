# salles

Réservation des salles de réunion (circuit : validation par le responsable logistique ;
le N+1 et l'assistante de direction consultent et commentent).

- `api.ts` : appels à `/api/salles` (référentiel) et `/api/demandes-salle` (réservations), libellés des statuts.
- `pages/DemandeSallePage` : formulaire avec planning du jour, contrôle des conflits et proposition d'alternative.
- `pages/SuiviDemandesSallePage` : demandes à valider (logistique) ou à suivre (N+1, assistante de direction).
- `pages/ListeSallesPage` : gestion des salles (logistique, administrateur).
- `components/DetailDemandeSalle` : détail, décision, annulation, commentaires et historique.

« Mes demandes » est dans `features/mes-demandes`.
