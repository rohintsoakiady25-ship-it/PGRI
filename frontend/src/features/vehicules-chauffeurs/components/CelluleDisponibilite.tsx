import Badge, { type TonBadge } from '@/components/common/Badge';
import { LIBELLE_DISPONIBILITE, type Disponibilite, type MissionResume } from '../api';

const TON: Record<Disponibilite, TonBadge> = { DISPONIBLE: 'succes', EN_MISSION: 'attention', INDISPONIBLE: 'danger', HORS_SERVICE: 'neutre' };
const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const quand = (iso: string) => fmt.format(new Date(iso)).replace(':', 'h');

interface Props {
  disponibilite: Disponibilite;
  motif?: string | null;
  mission: MissionResume | null;
  prochaineMission: MissionResume | null;
}

/** Disponibilité d'un véhicule ou d'un chauffeur, avec la mission en cours ou la prochaine. */
export default function CelluleDisponibilite({ disponibilite, motif, mission, prochaineMission }: Props) {
  let detail: string | null = null;
  if (disponibilite === 'EN_MISSION' && mission) detail = `jusqu’au ${quand(mission.fin)}`;
  else if (disponibilite === 'INDISPONIBLE') detail = motif ?? null;
  else if (prochaineMission) detail = `Prochaine : ${quand(prochaineMission.debut)}`;
  const titre = mission ?? prochaineMission;
  return (
    <span className="liste__empile liste__sans-retour" title={titre ? `${titre.references.join(', ')} → ${titre.destinations.join(', ')}` : undefined}>
      <Badge ton={TON[disponibilite]}>{LIBELLE_DISPONIBILITE[disponibilite]}</Badge>
      {detail && <span className="liste__discret">{detail}</span>}
    </span>
  );
}
