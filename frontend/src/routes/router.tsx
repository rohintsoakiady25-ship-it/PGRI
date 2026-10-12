import { createBrowserRouter, Navigate } from 'react-router-dom';
import RouteProtegee from '@/auth/RouteProtegee';
import RouteReservee from '@/auth/RouteReservee';
import { peutGererReferentiels, peutSuivreSalles } from '@/auth/droits';
import LoginPage from '@/features/auth/pages/LoginPage';
import AccueilPage from '@/features/accueil/pages/AccueilPage';
import DemandeDeplacementPage from '@/features/deplacements/pages/DemandeDeplacementPage';
import DemandeSallePage from '@/features/salles/pages/DemandeSallePage';
import DemandeFournituresPage from '@/features/fournitures/pages/DemandeFournituresPage';
import ListeVehiculesPage from '@/features/vehicules-chauffeurs/pages/ListeVehiculesPage';
import ListeChauffeursPage from '@/features/vehicules-chauffeurs/pages/ListeChauffeursPage';
import ListeSallesPage from '@/features/salles/pages/ListeSallesPage';
import PlanningSemainePage from '@/features/salles/pages/PlanningSemainePage';
import PlanningPublicPage from '@/features/salles/pages/PlanningPublicPage';
import SuiviDemandesSallePage from '@/features/salles/pages/SuiviDemandesSallePage';
import MesDemandesPage from '@/features/mes-demandes/pages/MesDemandesPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Planning des salles en lecture seule, sans connexion (lien public / QR code)
  { path: '/planning/:jeton', element: <PlanningPublicPage /> },
  {
    // Toutes les autres pages exigent d'être connecté
    element: <RouteProtegee />,
    children: [
      { path: '/', element: <Navigate to="/accueil" replace /> },
      { path: '/accueil', element: <AccueilPage /> },
      { path: '/mes-demandes', element: <MesDemandesPage /> },
      { path: '/demandes/deplacement', element: <DemandeDeplacementPage /> },
      {
        // Listes des voitures et des chauffeurs : logistique et administrateur seulement
        element: <RouteReservee autorise={peutGererReferentiels} />,
        children: [
          { path: '/deplacements/vehicules', element: <ListeVehiculesPage /> },
          { path: '/deplacements/chauffeurs', element: <ListeChauffeursPage /> },
        ],
      },
      { path: '/demandes/salle', element: <DemandeSallePage /> },
      {
        // Suivi des demandes de salle : logistique, N+1, assistante de direction
        element: <RouteReservee autorise={peutSuivreSalles} />,
        children: [{ path: '/salles/demandes', element: <SuiviDemandesSallePage /> }],
      },
      {
        element: <RouteReservee autorise={peutGererReferentiels} />,
        children: [
          { path: '/salles/liste', element: <ListeSallesPage /> },
          { path: '/salles/planning', element: <PlanningSemainePage /> },
        ],
      },
      { path: '/demandes/fournitures', element: <DemandeFournituresPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/accueil" replace /> },
]);
