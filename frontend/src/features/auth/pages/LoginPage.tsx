import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import logoMnp from '@/assets/logo-mnp.png';
import BoutonTheme from '@/theme/BoutonTheme';
import { api, messageErreur } from '@/api/client';
import { useAuth, type MethodeConnexion } from '@/auth/AuthContext';
import './LoginPage.css';

const TEXTES: Record<MethodeConnexion, { lead: string; placeholder: string; aide: string }> = {
  ad: {
    lead: "Utilisez l'identifiant et le mot de passe de votre poste de travail MNP.",
    placeholder: 'prenom.nom',
    aide: "Mot de passe oublié ou compte bloqué ? Contactez la DSII : votre compte est géré dans l'annuaire MNP.",
  },
  local: {
    lead: "Utilisez le compte PGRI créé pour vous par l'administrateur de la plateforme.",
    placeholder: 'identifiant',
    aide: "Mot de passe oublié ? Demandez à l'administrateur PGRI de le réinitialiser.",
  },
};

/** Page de connexion : Active Directory (LDAP) ou compte local PGRI. */
export default function LoginPage() {
  const { utilisateur, chargement, connecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [methode, setMethode] = useState<MethodeConnexion>('ad');
  const [adDisponible, setAdDisponible] = useState<boolean | null>(null);
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [mdpVisible, setMdpVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Méthodes proposées par le serveur : sans annuaire configuré, on bascule sur le compte local
  useEffect(() => {
    api
      .get<{ ad: boolean; local: boolean }>('/auth/methodes')
      .then((r) => {
        setAdDisponible(r.data.ad);
        if (!r.data.ad) setMethode('local');
      })
      .catch(() => setAdDisponible(null));
  }, []);

  // Après connexion : retour à la page demandée avant la redirection vers /login
  const depuis = (location.state as { depuis?: string } | null)?.depuis;
  const destination = depuis && depuis !== '/login' ? depuis : '/accueil';

  if (!chargement && utilisateur) return <Navigate to={destination} replace />;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!identifiant.trim() || !motDePasse) {
      setErreur("Saisissez l'identifiant et le mot de passe.");
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(methode, identifiant.trim(), motDePasse);
      navigate(destination, { replace: true });
    } catch (err) {
      setErreur(messageErreur(err, 'Connexion impossible. Réessayez.'));
      setMotDePasse('');
      setMdpVisible(false);
    } finally {
      setEnvoi(false);
    }
  }

  const textes = TEXTES[methode];

  return (
    <div className="login">
      <aside className="login__brand">
        <img className="login__logo" src={logoMnp} alt="Madagascar National Parks" />
        <div className="login__product">
          <p className="login__product-name">PGRI</p>
          <p className="login__product-desc">Plateforme unifiée de gestion des ressources internes</p>
          <hr className="login__ground" />
          <ul className="login__modules">
            <li>Déplacements de service</li>
            <li>Salles de réunion</li>
            <li>Fournitures</li>
          </ul>
        </div>
      </aside>

      <main className="login__panel">
        <BoutonTheme className="login__theme" />
        <form className="login__form" noValidate onSubmit={soumettre}>
          <h1 className="login__title">Connexion</h1>

          <div className="login__methodes" role="radiogroup" aria-label="Type de compte">
            {([
              ['ad', 'Active Directory'],
              ['local', 'Compte local'],
            ] as const).map(([valeur, libelle]) => (
              <label key={valeur} className="login__methode">
                <input
                  type="radio"
                  name="methode"
                  value={valeur}
                  checked={methode === valeur}
                  onChange={() => {
                    setMethode(valeur);
                    setErreur(null);
                  }}
                />
                {libelle}
              </label>
            ))}
          </div>

          <p className="login__lead">{textes.lead}</p>
          {methode === 'ad' && adDisponible === false && (
            <p className="login__note">
              La connexion Active Directory n'est pas encore configurée sur ce serveur. Utilisez un compte local.
            </p>
          )}

          {erreur && (
            <p className="login__erreur" role="alert">
              {erreur}
            </p>
          )}

          <div className="login__field">
            <label htmlFor="identifiant">Identifiant</label>
            <input
              id="identifiant"
              name="identifiant"
              type="text"
              autoComplete="username"
              placeholder={textes.placeholder}
              spellCheck={false}
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              aria-invalid={Boolean(erreur) || undefined}
            />
          </div>

          <div className="login__field">
            <label htmlFor="motDePasse">Mot de passe</label>
            <div className="login__mdp">
              <input
                id="motDePasse"
                name="motDePasse"
                type={mdpVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                aria-invalid={Boolean(erreur) || undefined}
              />
              <button
                type="button"
                className="login__voir-mdp"
                onClick={() => setMdpVisible((v) => !v)}
                aria-pressed={mdpVisible}
                aria-controls="motDePasse"
                aria-label={mdpVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                title={mdpVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {mdpVisible ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.2 9.5 7-0.4 1.1-1.2 2.5-2.4 3.7M6.6 6.6C4.6 7.9 3.1 9.9 2.5 12c1 2.8 4.5 7 9.5 7 1.9 0 3.6-0.6 5-1.5" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <button className="login__submit" type="submit" disabled={envoi}>
            {envoi ? 'Connexion…' : 'Se connecter'}
          </button>

          <p className="login__help">{textes.aide}</p>
        </form>

        <footer className="login__footer">DSII — Madagascar National Parks</footer>
      </main>
    </div>
  );
}
