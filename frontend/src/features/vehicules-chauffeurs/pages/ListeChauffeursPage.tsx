import ListePage from '@/components/liste/ListePage';

/** Liste des chauffeurs (entité Chauffeur, Figure 3) — données non branchées. */
export default function ListeChauffeursPage() {
  return (
    <ListePage
      titre="Liste des chauffeurs"
      intro="Chauffeurs de MNP affectables aux déplacements de service par le responsable logistique."
      placeholderRecherche="Rechercher par nom ou téléphone"
      filtres={[{ id: 'disponibilite', label: 'Disponibilité', options: ['Disponible', 'En mission'] }]}
      colonnes={[
        { label: 'Nom' },
        { label: 'Téléphone' },
        { label: 'N° de permis' },
        { label: 'Disponibilité' },
      ]}
      messageVide="Aucun chauffeur enregistré pour le moment."
    />
  );
}
