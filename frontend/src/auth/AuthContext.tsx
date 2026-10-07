import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, CLE_JETON, lireJeton } from '@/api/client';

export type MethodeConnexion = 'ad' | 'local';

export interface Utilisateur {
  id: string;
  login: string;
  source: 'AD' | 'LOCAL';
  nomComplet: string;
  email: string | null;
  direction: string | null;
  service: string | null;
  roles: string[];
}

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  /** Vérification de la session en cours au chargement de l'application. */
  chargement: boolean;
  connecter: (methode: MethodeConnexion, identifiant: string, motDePasse: string) => Promise<void>;
  deconnecter: () => void;
}

const Contexte = createContext<ContexteAuth | null>(null);

function ecrireJeton(jeton: string | null) {
  try {
    if (jeton) localStorage.setItem(CLE_JETON, jeton);
    else localStorage.removeItem(CLE_JETON);
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(() => Boolean(lireJeton()));

  const deconnecter = useCallback(() => {
    ecrireJeton(null);
    setUtilisateur(null);
  }, []);

  // Session existante : on récupère le profil (le jeton peut avoir expiré)
  useEffect(() => {
    if (!lireJeton()) return;
    api
      .get<Utilisateur>('/auth/moi')
      .then((r) => setUtilisateur(r.data))
      .catch(() => deconnecter())
      .finally(() => setChargement(false));
  }, [deconnecter]);

  useEffect(() => {
    window.addEventListener('pgri:session-expiree', deconnecter);
    return () => window.removeEventListener('pgri:session-expiree', deconnecter);
  }, [deconnecter]);

  const connecter = useCallback(async (methode: MethodeConnexion, identifiant: string, motDePasse: string) => {
    const r = await api.post<{ jeton: string; utilisateur: Utilisateur }>('/auth/login', { methode, identifiant, motDePasse });
    ecrireJeton(r.data.jeton);
    setUtilisateur(r.data.utilisateur);
  }, []);

  return <Contexte.Provider value={{ utilisateur, chargement, connecter, deconnecter }}>{children}</Contexte.Provider>;
}

export function useAuth(): ContexteAuth {
  const c = useContext(Contexte);
  if (!c) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return c;
}
