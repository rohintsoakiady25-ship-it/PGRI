import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import AccueilPage from '@/features/accueil/pages/AccueilPage';
import DemandeDeplacementPage from '@/features/deplacements/pages/DemandeDeplacementPage';
import DemandeSallePage from '@/features/salles/pages/DemandeSallePage';
import DemandeFournituresPage from '@/features/fournitures/pages/DemandeFournituresPage';
import PagePlaceholder from '@/components/common/PagePlaceholder';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/accueil', element: <AccueilPage /> },
  {
    path: '/mes-demandes',
    element: <PagePlaceholder titre="Mes demandes en cours" description="La liste de vos demandes et de leur statut sera développée ici." />,
  },
  { path: '/demandes/deplacement', element: <DemandeDeplacementPage /> },
  { path: '/demandes/salle', element: <DemandeSallePage /> },
  { path: '/demandes/fournitures', element: <DemandeFournituresPage /> },
]);
