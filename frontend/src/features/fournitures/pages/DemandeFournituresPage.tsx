import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageErreur } from '@/api/client';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import { demandesFournitureApi, stockApi, type ArticleCatalogue } from '../api';
import RechercheArticle from '../components/RechercheArticle';
import './DemandeFournituresPage.css';

interface Ligne {
  cle: number;
  articleId: string;
  quantite: string;
  observations: string;
}

/**
 * Demande de fournitures (rapport, section 4.1.4). Chaque ligne référence un article du catalogue
 * du magasin (ArticleStock) : l'unité vient de la fiche article et la remise met à jour le stock.
 * Après l'envoi : « Mes demandes ».
 */
export default function DemandeFournituresPage() {
  const prochaine = useRef(1);
  const nouvelleLigne = (): Ligne => ({ cle: prochaine.current++, articleId: '', quantite: '', observations: '' });
  const [lignes, setLignes] = useState<Ligne[]>(() => [nouvelleLigne()]);
  const [focusCle, setFocusCle] = useState<number | null>(null);
  const [catalogue, setCatalogue] = useState<ArticleCatalogue[] | null>(null);
  const [dateBesoin, setDateBesoin] = useState('');
  const [observations, setObservations] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    stockApi.catalogue().then(setCatalogue).catch(() => setCatalogue([]));
  }, []);

  const maj = (cle: number, champ: keyof Omit<Ligne, 'cle'>, valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));

  function ajouter() {
    const l = nouvelleLigne();
    setLignes((ls) => [...ls, l]);
    setFocusCle(l.cle); // le curseur va dans le choix d'article de la nouvelle ligne
  }

  function retirer(cle: number) {
    // Il reste toujours au moins une ligne
    setLignes((ls) => (ls.length > 1 ? ls.filter((x) => x.cle !== cle) : [nouvelleLigne()]));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const remplies = lignes.filter((l) => l.articleId || l.quantite);
    if (!remplies.length) return setErreur('Ajoutez au moins un article.');
    for (const l of remplies) {
      if (!l.articleId) return setErreur('Choisissez l’article de chaque ligne dans le catalogue.');
      const q = Number(l.quantite);
      if (!Number.isInteger(q) || q < 1) {
        const nom = catalogue?.find((a) => a.id === l.articleId)?.designation ?? 'un article';
        return setErreur(`Indiquez une quantité (nombre entier) pour « ${nom} ».`);
      }
    }
    const ids = remplies.map((l) => l.articleId);
    if (new Set(ids).size !== ids.length) return setErreur('Un même article apparaît sur plusieurs lignes : regroupez les quantités.');
    setEnvoi(true);
    try {
      const d = await demandesFournitureApi.soumettre({
        lignes: remplies.map((l) => ({ articleId: l.articleId, quantite: Number(l.quantite), observations: l.observations.trim() || null })),
        dateBesoin: dateBesoin || null,
        observations: observations.trim() || null,
      });
      const n = d.lignes.length;
      const suite = d.statut === 'EN_ATTENTE_N1' ? 'Votre supérieur direct va l’examiner.' : 'Le responsable logistique va l’examiner.';
      navigate('/mes-demandes', { state: { message: `Demande ${d.reference} envoyée : ${n} article${n > 1 ? 's' : ''}. ${suite}` } });
    } catch (err) {
      setErreur(messageErreur(err, 'La demande n’a pas pu être envoyée.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <DemandePage
      titre="Demande de fournitures"
      circuit={[
        { titre: 'Votre supérieur direct (N+1)', detail: 'Valide ou refuse la demande.' },
        { titre: 'Responsable logistique', detail: 'Valide la demande avant transmission au magasin.' },
        { titre: 'Magasinier', detail: 'Remet les fournitures et édite le bon de sortie.' },
      ]}
      onSoumettre={soumettre}
      envoi={envoi}
      erreur={erreur}
      brouillon={false}
    >
      <Section titre="Articles demandés">
        <div className="champ champ--large">
          <table className="lignes">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col" className="lignes__unite">Unité</th>
                <th scope="col" className="lignes__qte">Quantité</th>
                <th scope="col">Observations</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const article = catalogue?.find((a) => a.id === l.articleId);
                return (
                  <tr key={l.cle}>
                    <td data-label="Article">
                      <RechercheArticle
                        catalogue={catalogue}
                        articleId={l.articleId}
                        onChoisir={(id) => maj(l.cle, 'articleId', id)}
                        ariaLabel={`Article ${i + 1}`}
                        autoFocus={focusCle === l.cle}
                      />
                    </td>
                    <td data-label="Unité" className="lignes__unite">
                      {/* Unité reprise de la fiche article : hors du parcours au clavier */}
                      <input type="text" aria-label={`Unité de l’article ${i + 1}`} value={article?.unite ?? '—'} readOnly tabIndex={-1} />
                    </td>
                    <td data-label="Quantité" className="lignes__qte">
                      <input
                        type="number"
                        name="quantiteDemandee"
                        aria-label={`Quantité de l’article ${i + 1}`}
                        min={1}
                        step={1}
                        required
                        value={l.quantite}
                        onChange={(e) => maj(l.cle, 'quantite', e.target.value)}
                      />
                    </td>
                    <td data-label="Observations">
                      <input
                        type="text"
                        name="observations"
                        aria-label={`Observations sur l’article ${i + 1}`}
                        maxLength={200}
                        value={l.observations}
                        onChange={(e) => maj(l.cle, 'observations', e.target.value)}
                      />
                    </td>
                    <td className="lignes__action">
                      <button type="button" className="lignes__remove" onClick={() => retirer(l.cle)}
                        aria-label={`Retirer l’article ${i + 1}`} title="Retirer cette ligne">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div>
            <button type="button" className="btn btn--ghost" onClick={ajouter}>
              + Ajouter un article
            </button>
          </div>
        </div>
      </Section>

      <Section titre="Informations complémentaires">
        <Champ id="dateBesoin" label="Date du besoin" optionnel>
          <input id="dateBesoin" name="dateBesoin" type="date" min={new Date().toLocaleDateString('fr-CA')} value={dateBesoin}
            onChange={(e) => setDateBesoin(e.target.value)} />
        </Champ>
        <div />
        <Champ id="observationsGenerales" label="Observations" optionnel large>
          <textarea id="observationsGenerales" name="observationsGenerales" maxLength={2000} value={observations}
            onChange={(e) => setObservations(e.target.value)} />
        </Champ>
      </Section>
    </DemandePage>
  );
}
