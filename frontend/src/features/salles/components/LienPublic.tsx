import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { messageErreur } from '@/api/client';
import { lienPublicApi, urlPlanningPublic } from '../api';
import './LienPublic.css';

const TITRE_AFFICHE = 'Planning des salles de réunion';

/** Lien public du planning et son QR code : copier, télécharger, imprimer, régénérer (logistique). */
export default function LienPublic() {
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  function afficher(jeton: string) {
    const u = urlPlanningPublic(jeton);
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#1f140b', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setErreur('Le QR code n’a pas pu être généré.'));
  }

  useEffect(() => {
    lienPublicApi
      .lire()
      .then((l) => afficher(l.jeton))
      .catch((e) => setErreur(messageErreur(e, 'Le lien public n’a pas pu être chargé.')));
  }, []);

  async function copier() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setErreur('Copie impossible : sélectionnez le lien et copiez-le à la main.');
    }
  }

  async function regenerer() {
    setEnvoi(true);
    setErreur(null);
    try {
      afficher((await lienPublicApi.regenerer()).jeton);
      setConfirmer(false);
    } catch (e) {
      setErreur(messageErreur(e, 'Le lien n’a pas pu être régénéré.'));
    } finally {
      setEnvoi(false);
    }
  }

  /** Page d'impression : titre, QR code et adresse, à afficher près des salles. */
  function imprimer() {
    if (!qr || !url) return;
    const w = window.open('', '_blank', 'width=640,height=800');
    if (!w) {
      setErreur('Autorisez les fenêtres surgissantes pour imprimer, ou téléchargez l’image du QR code.');
      return;
    }
    const doc = w.document;
    doc.title = TITRE_AFFICHE;
    const style = doc.createElement('style');
    style.textContent =
      'body{font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#1f140b}' +
      'h1{font-size:28px;margin:0 0 8px}p{margin:0 0 24px;color:#5c4a3a}img{width:320px;height:320px}' +
      '.url{font-size:12px;word-break:break-all;margin-top:24px}';
    doc.head.appendChild(style);
    const h1 = doc.createElement('h1');
    h1.textContent = TITRE_AFFICHE;
    const p = doc.createElement('p');
    p.textContent = 'Scannez ce code pour voir les réservations de la semaine.';
    const img = doc.createElement('img');
    img.alt = 'QR code du planning des salles';
    img.src = qr;
    const lien = doc.createElement('p');
    lien.className = 'url';
    lien.textContent = url;
    doc.body.append(h1, p, img, lien);
    img.onload = () => {
      w.focus();
      w.print();
    };
  }

  if (!url) return <p className="lien-public__message">{erreur ?? 'Chargement…'}</p>;

  return (
    <div className="lien-public">
      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}
      <p className="lien-public__aide">
        Toute personne qui scanne ce QR code voit le planning de la semaine, sans se connecter : horaires, salles et objets des
        réunions <strong>confirmées</strong>. Les demandes en attente et le nom des demandeurs n’y figurent pas.
      </p>

      <div className="lien-public__corps">
        {qr ? <img className="lien-public__qr" src={qr} alt="QR code du lien public du planning des salles" /> : <div className="lien-public__qr" />}
        <div className="lien-public__actions">
          <label className="lien-public__libelle" htmlFor="lien-public-url">
            Lien public
          </label>
          <div className="lien-public__url">
            <input id="lien-public-url" readOnly value={url} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn--secondary" onClick={copier}>
              {copie ? 'Copié ✓' : 'Copier'}
            </button>
          </div>
          <div className="lien-public__boutons">
            <a className="btn btn--secondary" href={url} target="_blank" rel="noreferrer">
              Ouvrir
            </a>
            {qr && (
              <a className="btn btn--secondary" href={qr} download="qr-planning-salles.png">
                Télécharger le QR code
              </a>
            )}
            <button type="button" className="btn btn--primary" onClick={imprimer} disabled={!qr}>
              Imprimer
            </button>
          </div>
        </div>
      </div>

      <div className="lien-public__regenerer">
        {confirmer ? (
          <>
            <span>L’ancien lien et les QR codes déjà imprimés ne fonctionneront plus. Continuer ?</span>
            <button type="button" className="btn btn--petit" onClick={() => setConfirmer(false)}>
              Non
            </button>
            <button type="button" className="btn btn--petit btn--petit-danger" onClick={regenerer} disabled={envoi}>
              Oui, régénérer
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--petit" onClick={() => setConfirmer(true)}>
            Régénérer le lien
          </button>
        )}
      </div>
    </div>
  );
}
