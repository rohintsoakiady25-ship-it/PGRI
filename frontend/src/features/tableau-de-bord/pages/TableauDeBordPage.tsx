import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Badge from '@/components/common/Badge';
import { messageErreur } from '@/api/client';
import { quantiteAvecUnite } from '@/features/fournitures/api';
import { libelleMois, tableauDeBordApi, type TableauDeBord } from '../api';
import GraphiqueDemandes from '../components/GraphiqueDemandes';
import Barres from '../components/Barres';
import './TableauDeBordPage.css';

const moisCourant = () => new Date().toLocaleDateString('fr-CA').slice(0, 7);
const jourCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;
const heures = (h: number) => `${h.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;

/**
 * Tableau de bord de la logistique : ce qui attend une décision, la situation du jour, les alertes
 * et les indicateurs du mois. « Imprimer le rapport » produit le rapport mensuel (impression ou PDF).
 */
export default function TableauDeBordPage() {
  const [mois, setMois] = useState(moisCourant);
  const [d, setD] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setErreur(null);
    tableauDeBordApi.lire(mois).then(setD).catch((e) => setErreur(messageErreur(e, 'Le tableau de bord n’a pas pu être chargé.')));
  }, [mois]);

  const totalATraiter = d ? d.aTraiter.deplacements + d.aTraiter.salles + d.aTraiter.fournitures : 0;
  const nbAlertes = d ? d.alertes.stock.length + d.alertes.echeances.length : 0;

  return (
    <AppLayout>
      <div className="tdb">
        <div className="tdb__entete">
          <div>
            <h1 className="tdb__titre">Tableau de bord</h1>
            <p className="tdb__periode">Indicateurs de {libelleMois(mois)}</p>
          </div>
          <div className="tdb__outils">
            <label className="tdb__mois">
              <span className="sr-only">Mois</span>
              <input type="month" value={mois} max={moisCourant()} onChange={(e) => e.target.value && setMois(e.target.value)} />
            </label>
            <button type="button" className="btn btn--primary" onClick={() => window.print()} disabled={!d}>
              Imprimer le rapport
            </button>
          </div>
        </div>

        {erreur && <p className="tdb-erreur" role="alert">{erreur}</p>}
        {!d && !erreur && <p className="tdb-vide">Chargement…</p>}

        {d && (
          <>
            {/* Chiffres clés : aujourd'hui, quel que soit le mois choisi */}
            <section className="tuiles" aria-label="Situation du jour">
              <div className="tuile tuile--accent">
                <span className="tuile__libelle">À traiter par la logistique</span>
                <span className="tuile__valeur">{totalATraiter}</span>
                <span className="tuile__detail">
                  {totalATraiter ? 'demandes en attente de votre validation' : 'rien en attente'}
                </span>
              </div>
              <div className="tuile">
                <span className="tuile__libelle">Véhicules en mission</span>
                <span className="tuile__valeur">
                  {d.aujourdhui.vehiculesEnMission}
                  <span className="tuile__sur"> / {d.aujourdhui.vehiculesActifs}</span>
                </span>
                <span className="tuile__detail">{pluriel(d.aujourdhui.missionsEnCours, 'mission')} en cours</span>
              </div>
              <div className="tuile">
                <span className="tuile__libelle">Réunions aujourd’hui</span>
                <span className="tuile__valeur">{d.aujourdhui.reunions}</span>
                <span className="tuile__detail">réservations confirmées</span>
              </div>
              <div className="tuile">
                <span className="tuile__libelle">Alertes</span>
                <span className="tuile__valeur">{nbAlertes}</span>
                <span className="tuile__detail">
                  {pluriel(d.alertes.echeances.length, 'échéance')} véhicule · {d.alertes.stock.length} stock bas
                </span>
              </div>
            </section>

            <section className="tdb-carte tdb-carte--large" aria-labelledby="titre-a-traiter">
              <h2 id="titre-a-traiter" className="tdb-carte__titre">À traiter</h2>
              <div className="a-traiter">
                {[
                  { n: d.aTraiter.deplacements, libelle: 'Déplacements', lien: '/deplacements/demandes' },
                  { n: d.aTraiter.salles, libelle: 'Salles de réunion', lien: '/salles/demandes' },
                  { n: d.aTraiter.fournitures, libelle: 'Fournitures', lien: '/fournitures/demandes' },
                ].map((x) => (
                  <Link key={x.libelle} to={x.lien} className={`a-traiter__lien${x.n ? ' a-traiter__lien--actif' : ''}`}>
                    <span className="a-traiter__nombre">{x.n}</span>
                    <span>{x.libelle}</span>
                  </Link>
                ))}
              </div>
            </section>

            <div className="tdb-grille">
              <section className="tdb-carte" aria-labelledby="titre-demandes">
                <h2 id="titre-demandes" className="tdb-carte__titre">Demandes soumises par mois</h2>
                <p className="tdb-carte__aide">Six derniers mois, par module</p>
                <GraphiqueDemandes donnees={d.demandesParMois} />
              </section>

              <section className="tdb-carte" aria-labelledby="titre-echeances">
                <h2 id="titre-echeances" className="tdb-carte__titre">Échéances des véhicules</h2>
                <p className="tdb-carte__aide">Assurances et visites techniques expirées ou à renouveler sous 30 jours</p>
                {d.alertes.echeances.length ? (
                  <table className="tdb-table">
                    <tbody>
                      {d.alertes.echeances.map((e) => (
                        <tr key={`${e.immatriculation}-${e.quoi}`}>
                          <td><strong>{e.immatriculation}</strong></td>
                          <td>{e.quoi}</td>
                          <td className="tdb-table__num">{jourCourt(e.fin)}</td>
                          <td><Badge ton={e.expiree ? 'danger' : 'attention'}>{e.expiree ? 'Expirée' : 'À renouveler'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="tdb-vide">Aucune échéance proche.</p>
                )}
              </section>

              <section className="tdb-carte" aria-labelledby="titre-vehicules">
                <h2 id="titre-vehicules" className="tdb-carte__titre">Utilisation des véhicules</h2>
                <p className="tdb-carte__aide">Missions de {libelleMois(d.mois)} (survol : heures de mission)</p>
                <Barres
                  couleur="var(--serie-deplacements)"
                  vide="Aucune mission ce mois-ci."
                  barres={d.vehicules.map((v) => ({
                    libelle: v.immatriculation, valeur: v.missions, texte: pluriel(v.missions, 'mission'), detail: heures(v.heures),
                  }))}
                />
              </section>

              <section className="tdb-carte" aria-labelledby="titre-salles">
                <h2 id="titre-salles" className="tdb-carte__titre">Occupation des salles</h2>
                <p className="tdb-carte__aide">Heures réservées sur les heures ouvrables du mois (8h–18h, lundi au vendredi)</p>
                {d.salles.length ? (
                  <ul className="jauges">
                    {d.salles.map((s) => (
                      <li key={s.nom} className="jauge">
                        <span className="jauge__entete">
                          <span>{s.nom}</span>
                          <span className="jauge__valeur">{Math.round(s.taux * 100)} %</span>
                        </span>
                        <span className="jauge__piste" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.taux * 100)}
                          aria-label={`Occupation de ${s.nom}`}>
                          <span className="jauge__remplissage" style={{ width: `${s.taux * 100}%` }} />
                        </span>
                        <span className="jauge__detail">
                          {heures(s.heures)} sur {heures(s.heuresOuvrables)} · {pluriel(s.reunions, 'réunion')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tdb-vide">Aucune salle enregistrée.</p>
                )}
              </section>

              <section className="tdb-carte" aria-labelledby="titre-directions">
                <h2 id="titre-directions" className="tdb-carte__titre">Fournitures remises par direction</h2>
                <p className="tdb-carte__aide">Quantités remises en {libelleMois(d.mois)}</p>
                <Barres
                  couleur="var(--serie-fournitures)"
                  vide="Aucune fourniture remise ce mois-ci."
                  barres={d.fournitures.parDirection.map((x) => ({
                    libelle: x.direction, valeur: x.articles, texte: pluriel(x.articles, 'article'), detail: pluriel(x.demandes, 'demande'),
                  }))}
                />
              </section>

              <section className="tdb-carte" aria-labelledby="titre-articles">
                <h2 id="titre-articles" className="tdb-carte__titre">Articles les plus remis</h2>
                <p className="tdb-carte__aide">Sorties de stock de {libelleMois(d.mois)}</p>
                <Barres
                  couleur="var(--serie-fournitures)"
                  vide="Aucune sortie de stock ce mois-ci."
                  barres={d.fournitures.topArticles.map((a) => ({ libelle: a.designation, valeur: a.quantite, texte: quantiteAvecUnite(a.quantite, a.unite) }))}
                />
                {d.alertes.stock.length > 0 && (
                  <>
                    <h3 className="tdb-carte__sous-titre">Stock bas ou en rupture</h3>
                    <ul className="stock-bas">
                      {d.alertes.stock.map((a) => (
                        <li key={a.reference}>
                          <span>{a.designation}</span>
                          <Badge ton={a.quantite === 0 ? 'danger' : 'attention'}>
                            {a.quantite === 0 ? 'Rupture' : `${quantiteAvecUnite(a.quantite, a.unite)} (seuil ${a.seuil})`}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>

            <p className="tdb__pied">Rapport généré le {new Date().toLocaleString('fr-FR')} — PGRI, DSII Madagascar National Parks</p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
