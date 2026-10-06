import AppLayout from '@/layouts/AppLayout';
import './AccueilPage.css';

/** Page d'accueil — les demandes sont accessibles depuis le menu de gauche. */
export default function AccueilPage() {
  return (
    <AppLayout>
      <section className="accueil">
        <h1 className="sr-only">Accueil</h1>
        <p className="accueil__vide">Choisissez un type de demande dans le menu à gauche.</p>
      </section>
    </AppLayout>
  );
}
