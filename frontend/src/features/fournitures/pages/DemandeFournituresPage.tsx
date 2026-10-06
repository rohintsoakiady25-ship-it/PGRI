import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import './DemandeFournituresPage.css';

/** Demande de fournitures — maquette statique (champs : rapport, section 4.1.4). */
export default function DemandeFournituresPage() {
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
              <tr>
                <td data-label="Article">
                  <select name="article" aria-label="Article" defaultValue="">
                    <option value="" disabled>
                      Choisir un article
                    </option>
                  </select>
                </td>
                <td data-label="Unité" className="lignes__unite">
                  <input type="text" aria-label="Unité" value="—" readOnly />
                </td>
                <td data-label="Quantité" className="lignes__qte">
                  <input type="number" name="quantiteDemandee" aria-label="Quantité" min={1} />
                </td>
                <td data-label="Observations">
                  <input type="text" name="observations" aria-label="Observations" />
                </td>
                <td className="lignes__action">
                  <button type="button" className="lignes__remove" aria-label="Retirer cette ligne">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div>
            <button type="button" className="btn btn--ghost">
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
