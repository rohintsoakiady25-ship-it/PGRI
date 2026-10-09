import './Badge.css';

export type TonBadge = 'succes' | 'attention' | 'danger' | 'neutre';

/** Pastille de statut (disponibilité, état technique…). */
export default function Badge({ ton, children }: { ton: TonBadge; children: string }) {
  return <span className={`badge badge--${ton}`}>{children}</span>;
}
