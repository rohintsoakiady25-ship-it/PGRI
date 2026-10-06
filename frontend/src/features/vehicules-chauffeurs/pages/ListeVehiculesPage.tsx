import ListePage from '@/components/liste/ListePage';

/** Liste des voitures (entité Vehicule, Figure 3) — données non branchées. */
export default function ListeVehiculesPage() {
  return (
    <ListePage
      titre="Liste des voitures"
      intro="Véhicules de MNP disponibles pour les déplacements de service. Le responsable logistique les affecte aux missions validées."
      placeholderRecherche="Rechercher par immatriculation ou modèle"
      filtres={[
        { id: 'etat', label: 'État technique', options: ['Bon état', 'À surveiller', 'En réparation'] },
        { id: 'disponibilite', label: 'Disponibilité', options: ['Disponible', 'En mission'] },
      ]}
      colonnes={[
        { label: 'Immatriculation' },
        { label: 'Marque et modèle' },
        { label: 'Places', numerique: true },
        { label: 'Kilométrage', numerique: true },
        { label: 'État technique' },
        { label: 'Disponibilité' },
      ]}
      messageVide="Aucune voiture enregistrée pour le moment."
    />
  );
}
