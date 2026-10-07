import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Pages réservées aux utilisateurs connectés : sinon, retour à la connexion (puis à la page demandée). */
export default function RouteProtegee() {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <p className="sr-only" role="status">Vérification de la session…</p>;
  if (!utilisateur) return <Navigate to="/login" replace state={{ depuis: location.pathname }} />;
  return <Outlet />;
}
