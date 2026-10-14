import { useRef, useState } from 'react';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import './DemandeFournituresPage.css';

/** Unités proposées ; le demandeur peut en saisir une autre. */
const UNITES = ['pièce', 'paquet', 'boîte', 'rame', 'carton', 'sachet', 'rouleau', 'flacon', 'lot', 'litre'];

interface Ligne {
  cle: number;
  article: string;
  unite: string;
  quantite: string;
}

/**
 * Demande de fournitures (rapport, section 4.1.4). Pas de catalogue ni de stock :
 * le demandeur décrit chaque article (libellé, unité, quantité).
 * Formulaire de saisie seulement : l'envoi sera branché avec le module fournitures.
 */
export default function DemandeFournituresPage() {
  const prochaine = useRef(1);
  const nouvelleLigne = (): Ligne => ({ cle: prochaine.current++, article: '', unite: '', quantite: '' });
  const [lignes, setLignes] = useState<Ligne[]>(() => [nouvelleLigne()]);
  const [focusCle, setFocusCle] = useState<number | null>(null);

  const maj = (cle: number, champ: keyof Omit<Ligne, 'cle'>, valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));

  function ajouter() {
    const l = nouvelleLigne();
    setLignes((ls) => [...ls, l]);
    setFocusCle(l.cle); // le curseur va dans le libellé de la nouvelle ligne
  }

  function retirer(cle: number) {
    // Il reste toujours au moins une ligne
    setLignes((ls) => (ls.length > 1 ? ls.filter((x) => x.cle !== cle) : [nouvelleLigne()]));
  }

  return (
    <DemandePage
      titre="Demande de fournitures"
      intro="Décrivez chaque article demandé : son libellé, l’unité (pièce, paquet, boîte…) et la quantité. Une ligne par article."
      circuit={[
        { titre: 'Votre supérieur direct (N+1)', detail: 'Valide ou refuse la demande.' },
        { titre: 'Responsable logistique', detail: 'Valide la demande avant transmission au magasin.' },
        { titre: 'Magasinier', detail: 'Remet les fournitures et édite le bon de sortie.' },
      ]}
    >
      <Section titre="Articles demandés">
        <div className="champ champ--large">
          <datalist id="unites-fournitures">
            {UNITES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <table className="lignes">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col" className="lignes__unite">Unité</th>
                <th scope="col" className="lignes__qte">Quantité</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.cle}>
                  <td data-label="Article">
                    <input
                      type="text"
                      name="article"
                      aria-label={`Article ${i + 1}`}
                      placeholder="Ex. Stylo bille bleu"
                      maxLength={150}
                      required
                      value={l.article}
                      autoFocus={focusCle === l.cle}
                      onChange={(e) => maj(l.cle, 'article', e.target.value)}
                    />
                  </td>
                  <td data-label="Unité" className="lignes__unite">
                    <input
                      type="text"
                      name="unite"
                      list="unites-fournitures"
                      aria-label={`Unité de l’article ${i + 1}`}
                      placeholder="pièce"
                      maxLength={30}
                      required
                      value={l.unite}
                      onChange={(e) => maj(l.cle, 'unite', e.target.value)}
                    />
                  </td>
                  <td data-label="Quantité" className="lignes__qte">
                    <input
                      type="number"
                      name="quantite"
                      aria-label={`Quantité de l’article ${i + 1}`}
                      min={1}
                      step={1}
                      required
                      value={l.quantite}
                      onChange={(e) => maj(l.cle, 'quantite', e.target.value)}
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
              ))}
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
