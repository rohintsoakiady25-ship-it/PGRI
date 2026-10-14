import { useRef, useState } from 'react';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import './DemandeFournituresPage.css';

/** Article du catalogue du magasin (ArticleStock). */
interface ArticleCatalogue {
  id: string;
  designation: string;
  unite: string;
}

/** Catalogue du magasin : sera chargé depuis l'API avec le module fournitures (stock). */
const CATALOGUE: ArticleCatalogue[] = [];

interface Ligne {
  cle: number;
  articleId: string;
  quantite: string;
  observations: string;
}

/**
 * Demande de fournitures (rapport, section 4.1.4). Chaque ligne référence un article du catalogue
 * du magasin (ArticleStock) : l'unité vient de la fiche article et la remise met à jour le stock.
 * Formulaire de saisie seulement : l'envoi sera branché avec le module fournitures.
 */
export default function DemandeFournituresPage() {
  const prochaine = useRef(1);
  const nouvelleLigne = (): Ligne => ({ cle: prochaine.current++, articleId: '', quantite: '', observations: '' });
  const [lignes, setLignes] = useState<Ligne[]>(() => [nouvelleLigne()]);
  const [focusCle, setFocusCle] = useState<number | null>(null);

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

  return (
    <DemandePage
      titre="Demande de fournitures"
      intro="Ajoutez une ligne par article. Les articles sont choisis dans le catalogue du magasin."
      circuit={[
        { titre: 'Votre supérieur direct (N+1)', detail: 'Valide ou refuse la demande.' },
        { titre: 'Responsable logistique', detail: 'Valide la demande avant transmission au magasin.' },
        { titre: 'Magasinier', detail: 'Remet les fournitures et édite le bon de sortie.' },
      ]}
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
                const article = CATALOGUE.find((a) => a.id === l.articleId);
                return (
                  <tr key={l.cle}>
                    <td data-label="Article">
                      <select
                        name="article"
                        aria-label={`Article ${i + 1}`}
                        required
                        value={l.articleId}
                        autoFocus={focusCle === l.cle}
                        onChange={(e) => maj(l.cle, 'articleId', e.target.value)}
                      >
                        <option value="" disabled>
                          {CATALOGUE.length ? 'Choisir un article' : 'Catalogue du magasin à venir'}
                        </option>
                        {CATALOGUE.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.designation}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Unité" className="lignes__unite">
                      <input type="text" aria-label={`Unité de l’article ${i + 1}`} value={article?.unite ?? '—'} readOnly />
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
          <input id="dateBesoin" name="dateBesoin" type="date" />
        </Champ>
        <div />
        <Champ id="observationsGenerales" label="Observations" optionnel large>
          <textarea id="observationsGenerales" name="observationsGenerales" />
        </Champ>
      </Section>
    </DemandePage>
  );
}
