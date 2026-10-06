import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import logoMnp from '@/assets/logo-mnp.png';
import BoutonTheme from '@/theme/BoutonTheme';
import {
  IconAccueil, IconFournitures, IconMenu, IconMesDemandes, IconPanneau, IconSalle, IconUtilisateur, IconVehicule,
} from '@/components/common/icons';
import './AppLayout.css';

const CLE_REPLIE = 'pgri.menuReplie';

const menu = [
  { titre: null, liens: [{ to: '/accueil', label: 'Accueil', icone: <IconAccueil /> }] },
  {
    titre: 'Nouvelle demande',
    liens: [
      { to: '/demandes/deplacement', label: 'Déplacement', icone: <IconVehicule /> },
      { to: '/demandes/salle', label: 'Salle de réunion', icone: <IconSalle /> },
      { to: '/demandes/fournitures', label: 'Fournitures', icone: <IconFournitures /> },
    ],
  },
];

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

  // Sur mobile, le menu se referme après navigation
  useEffect(() => setOuvertMobile(false), [pathname]);

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
                {groupe.liens.map((l) => (
                  <li key={l.to}>
                    <NavLink to={l.to} className="menu__lien" title={replie ? l.label : undefined}>
                      <span className="menu__icone">{l.icone}</span>
                      <span className="menu__label">{l.label}</span>
                    </NavLink>
                  </li>
                ))}
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
            <span className="barre__nom">Utilisateur MNP</span>
            <Link to="/login" className="barre__deconnexion">
              Se déconnecter
            </Link>
          </div>
        </header>

        <main className="shell__main">{children}</main>
      </div>
    </div>
  );
}
