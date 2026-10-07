import { createBrowserRouter, Navigate } from 'react-router-dom';
import RouteProtegee from '@/auth/RouteProtegee';
import LoginPage from '@/features/auth/pages/LoginPage';
import AccueilPage from '@/features/accueil/pages/AccueilPage';
import DemandeDeplacementPage from '@/features/deplacements/pages/DemandeDeplacementPage';
import DemandeSallePage from '@/features/salles/pages/DemandeSallePage';
import DemandeFournituresPage from '@/features/fournitures/pages/DemandeFournituresPage';
import ListeVehiculesPage from '@/features/vehicules-chauffeurs/pages/ListeVehiculesPage';
import ListeChauffeursPage from '@/features/vehicules-chauffeurs/pages/ListeChauffeursPage';
import PagePlaceholder from '@/components/common/PagePlaceholder';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    // Toutes les autres pages exigent d'être connecté
    element: <RouteProtegee />,
    children: [
      { path: '/', element: <Navigate to="/accueil" replace /> },
      { path: '/accueil', element: <AccueilPage /> },
      {
        path: '/mes-demandes',
        element: <PagePlaceholder titre="Mes demandes en cours" description="La liste de vos demandes et de leur statut sera développée ici." />,
      },
      { path: '/demandes/deplacement', element: <DemandeDeplacementPage /> },
      { path: '/deplacements/vehicules', element: <ListeVehiculesPage /> },
      { path: '/deplacements/chauffeurs', element: <ListeChauffeursPage /> },
      { path: '/demandes/salle', element: <DemandeSallePage /> },
      { path: '/demandes/fournitures', element: <DemandeFournituresPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/accueil" replace /> },
]);
