import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type Utilisateur } from './AuthContext';

/** Pages réservées à certains rôles : les autres utilisateurs sont renvoyés à l'accueil (l'API vérifie aussi). */
export default function RouteReservee({ autorise }: { autorise: (u: Utilisateur | null) => boolean }) {
  const { utilisateur } = useAuth();
  return autorise(utilisateur) ? <Outlet /> : <Navigate to="/accueil" replace />;
}
