import axios, { AxiosError } from 'axios';

export const CLE_JETON = 'pgri.jeton';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

export function lireJeton(): string | null {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}

// Jeton JWT ajouté à chaque appel
api.interceptors.request.use((config) => {
  const jeton = lireJeton();
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;
  return config;
});

// Session expirée : on prévient l'application (sauf pour la tentative de connexion elle-même)
api.interceptors.response.use(
  (r) => r,
  (e: AxiosError) => {
    if (e.response?.status === 401 && !e.config?.url?.includes('/auth/login')) {
      window.dispatchEvent(new Event('pgri:session-expiree'));
    }
    return Promise.reject(e);
  },
);

/** Message d'erreur lisible à partir d'une réponse de l'API. */
export function messageErreur(e: unknown, parDefaut = 'Une erreur est survenue. Réessayez.'): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  if (!err.response) return "Le serveur PGRI ne répond pas. Vérifiez qu'il est lancé.";
  const m = err.response.data?.message;
  return Array.isArray(m) ? m[0] : m || parDefaut;
}
