import logoMnp from '@/assets/logo-mnp.png';
import BoutonTheme from '@/theme/BoutonTheme';
import './LoginPage.css';

/** Page de connexion — maquette statique, aucune logique branchée. */
export default function LoginPage() {
  return (
    <div className="login">
      <aside className="login__brand">
        <img className="login__logo" src={logoMnp} alt="Madagascar National Parks" />
        <div className="login__product">
          <p className="login__product-name">PGRI</p>
          <p className="login__product-desc">Plateforme unifiée de gestion des ressources internes</p>
          <hr className="login__ground" />
          <ul className="login__modules">
            <li>Déplacements de service</li>
            <li>Salles de réunion</li>
            <li>Fournitures</li>
          </ul>
        </div>
      </aside>

      <main className="login__panel">
        <BoutonTheme className="login__theme" />
        <form className="login__form" noValidate>
          <h1 className="login__title">Connexion</h1>
          <p className="login__lead">
            Utilisez l'identifiant et le mot de passe de votre poste de travail MNP.
          </p>

          <div className="login__field">
            <label htmlFor="identifiant">Identifiant</label>
            <input
              id="identifiant"
              name="identifiant"
              type="text"
              autoComplete="username"
              placeholder="prenom.nom"
              spellCheck={false}
            />
          </div>

          <div className="login__field">
            <label htmlFor="motDePasse">Mot de passe</label>
            <input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" />
          </div>

          <button className="login__submit" type="submit">
            Se connecter
          </button>

          <p className="login__help">
            Mot de passe oublié ou compte bloqué ? Contactez la DSII : votre compte est géré dans l'annuaire MNP.
          </p>
        </form>

        <footer className="login__footer">DSII — Madagascar National Parks</footer>
      </main>
    </div>
  );
}
