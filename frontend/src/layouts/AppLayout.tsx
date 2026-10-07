import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import logoMnp from '@/assets/logo-mnp.png';
import BoutonTheme from '@/theme/BoutonTheme';
import {
  IconAccueil, IconChauffeur, IconChevron, IconFournitures, IconMenu, IconMesDemandes, IconNouvelleDemande, IconPanneau,
  IconSalle, IconUtilisateur, IconVehicule,
} from '@/components/common/icons';
import './AppLayout.css';

const CLE_REPLIE = 'pgri.menuReplie';

interface LienMenu {
  to: string;
  label: string;
  icone: ReactNode;
  /** Sous-menus : le lien devient un groupe dépliable. */
  enfants?: { to: string; label: string; icone: ReactNode }[];
}

const menu: { titre: string | null; liens: LienMenu[] }[] = [
  { titre: null, liens: [{ to: '/accueil', label: 'Accueil', icone: <IconAccueil /> }] },
  {
    titre: 'Modules',
    liens: [
      {
        to: '/demandes/deplacement',
        label: 'Déplacements',
        icone: <IconVehicule />,
        enfants: [
          { to: '/demandes/deplacement', label: 'Demande', icone: <IconNouvelleDemande /> },
          { to: '/deplacements/vehicules', label: 'Liste des voitures', icone: <IconVehicule taille={18} /> },
          { to: '/deplacements/chauffeurs', label: 'Liste des chauffeurs', icone: <IconChauffeur /> },
        ],
      },
      { to: '/demandes/salle', label: 'Salle de réunion', icone: <IconSalle /> },
      { to: '/demandes/fournitures', label: 'Fournitures', icone: <IconFournitures /> },
    ],
  },
];

const contientPage = (lien: LienMenu, chemin: string) => lien.enfants?.some((e) => e.to === chemin) ?? false;

function lireReplie() {
  try {
    return localStorage.getItem(CLE_REPLIE) === '1';
  } catch {
    return false;
  }
}

/** Mise en page des écrans connectés : menu latéral, barre du haut, contenu. Utilisateur fictif tant que l'authentification n'est pas branchée. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const [replie, setReplie] = useState(lireReplie);
  const [ouvertMobile, setOuvertMobile] = useState(false);
  const { pathname } = useLocation();
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();

  function seDeconnecter() {
    deconnecter();
    navigate('/login', { replace: true });
  }
  // Groupes dépliés : celui de la page courante est ouvert d'office
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(
    () => new Set(menu.flatMap((g) => g.liens).filter((l) => contientPage(l, pathname)).map((l) => l.label)),
  );

  // Sur mobile, le menu se referme après navigation
  useEffect(() => setOuvertMobile(false), [pathname]);

  function basculerGroupe(label: string) {
    setGroupesOuverts((ouverts) => {
      const suivant = new Set(ouverts);
      if (suivant.has(label)) suivant.delete(label);
      else suivant.add(label);
      return suivant;
    });
  }

  function basculer() {
    setReplie((r) => {
      try {
        localStorage.setItem(CLE_REPLIE, r ? '0' : '1');
      } catch {
        /* stockage indisponible : préférence non mémorisée */
      }
      return !r;
    });
  }

  return (
    <div className={`shell${replie ? ' shell--replie' : ''}${ouvertMobile ? ' shell--menu-ouvert' : ''}`}>
      <aside className="menu" aria-label="Menu principal">
        <div className="menu__haut">
          <Link to="/accueil" className="menu__marque">
            <img src={logoMnp} alt="Madagascar National Parks" className="menu__logo" />
            <span className="menu__marque-texte">
              <strong>PGRI</strong>
              <span>Ressources internes</span>
            </span>
          </Link>
          <button
            type="button"
            className="menu__replier"
            onClick={basculer}
            aria-label={replie ? 'Déplier le menu' : 'Replier le menu'}
            title={replie ? 'Déplier le menu' : 'Replier le menu'}
          >
            <IconPanneau replie={replie} />
          </button>
        </div>

        <nav className="menu__nav">
          {menu.map((groupe, i) => (
            <div key={i} className="menu__groupe">
              {groupe.titre && <p className="menu__titre">{groupe.titre}</p>}
              <ul>
                {groupe.liens.map((l) => {
                  if (!l.enfants) {
                    return (
                      <li key={l.to}>
                        <NavLink to={l.to} className="menu__lien" title={replie ? l.label : undefined}>
                          <span className="menu__icone">{l.icone}</span>
                          <span className="menu__label">{l.label}</span>
                        </NavLink>
                      </li>
                    );
                  }

                  const ouvert = groupesOuverts.has(l.label);
                  const actif = contientPage(l, pathname);
                  const idSousMenu = `sous-menu-${l.label}`;
                  return (
                    <li key={l.label}>
                      {/* Menu replié : l'icône mène directement à la première page du groupe */}
                      <NavLink to={l.to} className={`menu__lien menu__lien--raccourci${actif ? ' active' : ''}`} title={l.label}>
                        <span className="menu__icone">{l.icone}</span>
                      </NavLink>
                      <button
                        type="button"
                        className={`menu__lien menu__groupe-bouton${actif ? ' menu__groupe-bouton--actif' : ''}`}
                        aria-expanded={ouvert}
                        aria-controls={idSousMenu}
                        onClick={() => basculerGroupe(l.label)}
                      >
                        <span className="menu__icone">{l.icone}</span>
                        <span className="menu__label">{l.label}</span>
                        <span className="menu__chevron">
                          <IconChevron ouvert={ouvert} />
                        </span>
                      </button>
                      <ul id={idSousMenu} className="menu__sous-menu" hidden={!ouvert}>
                        {l.enfants.map((e) => (
                          <li key={e.to}>
                            <NavLink to={e.to} end className="menu__lien menu__lien--enfant">
                              <span className="menu__icone">{e.icone}</span>
                              <span className="menu__label">{e.label}</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <p className="menu__pied">DSII — Madagascar National Parks</p>
      </aside>

      <button type="button" className="shell__voile" aria-label="Fermer le menu" onClick={() => setOuvertMobile(false)} />

      <div className="shell__colonne">
        <header className="barre">
          <button type="button" className="barre__menu" aria-label="Ouvrir le menu" onClick={() => setOuvertMobile(true)}>
            <IconMenu />
          </button>

          <NavLink to="/mes-demandes" className="barre__lien">
            <IconMesDemandes />
            <span className="barre__lien-texte">Mes demandes en cours</span>
          </NavLink>

          <BoutonTheme />

          <div className="barre__utilisateur">
            <span className="barre__avatar" aria-hidden="true">
              <IconUtilisateur />
            </span>
            <span className="barre__nom" title={utilisateur ? `${utilisateur.login} · ${utilisateur.source === 'AD' ? 'Active Directory' : 'compte local'}` : undefined}>
              {utilisateur?.nomComplet ?? ''}
            </span>
            <button type="button" className="barre__deconnexion" onClick={seDeconnecter}>
              Se déconnecter
            </button>
          </div>
        </header>

        <main className="shell__main">{children}</main>
      </div>
    </div>
  );
}
