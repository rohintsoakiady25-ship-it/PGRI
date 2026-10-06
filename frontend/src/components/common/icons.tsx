/** Icônes de l'application : trait de 1,75, coins arrondis, couleur héritée du texte. */
const base = (taille: number) =>
  ({ width: taille, height: taille, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }) as const;

export const IconAccueil = ({ taille = 20 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
  </svg>
);

export const IconVehicule = ({ taille = 20 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <path d="M5 16h14v-4.2a2 2 0 0 0-.4-1.2L16.5 7.7A2 2 0 0 0 14.9 7H8.6a2 2 0 0 0-1.7.9L5.4 10.4A2 2 0 0 0 5 11.6Z" />
    <path d="M3.5 11h17" />
    <circle cx="8" cy="16.5" r="1.8" />
    <circle cx="16" cy="16.5" r="1.8" />
  </svg>
);

export const IconSalle = ({ taille = 20 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <rect x="3.5" y="4" width="17" height="10.5" rx="1.5" />
    <path d="M12 14.5V20M8.5 20h7M7.5 8.5h5M7.5 11h3" />
  </svg>
);

export const IconFournitures = ({ taille = 20 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9Z" />
    <path d="m4 7.5 8 4 8-4M12 11.5v9" />
  </svg>
);

export const IconMesDemandes = ({ taille = 18 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v2.5H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </svg>
);

export const IconUtilisateur = ({ taille = 18 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5a7 7 0 0 1 14 0" />
  </svg>
);

/** Panneau latéral avec flèche : replier / déplier le menu. */
export const IconPanneau = ({ taille = 20, replie = false }: { taille?: number; replie?: boolean }) => (
  <svg {...base(taille)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9 4.5v15" />
    <path d={replie ? 'm13 10 2 2-2 2' : 'm15 10-2 2 2 2'} />
  </svg>
);

export const IconMenu = ({ taille = 22 }: { taille?: number }) => (
  <svg {...base(taille)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
