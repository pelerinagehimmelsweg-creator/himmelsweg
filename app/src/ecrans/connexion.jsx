import { useState } from 'preact/hooks';
import logo from '../composants/logo.png';

export function Connexion({ donnees, erreur }) {
  const [msg, setMsg] = useState('');
  const google = () => donnees.connexionGoogle().catch((e) => setMsg(e.message));

  return (
    <div class="connexion">
      <img src={logo} alt="Himmelsweg" width="120" height="120" />
      <h1>Himmelsweg</h1>
      <p class="intro">L’application du pèlerinage, 7, 8 et 9 mai 2027.</p>

      {(erreur || msg) && <p class="alerte">{erreur || msg}</p>}

      <section class="carte">
        <h2>Pèlerins et équipes</h2>
        <p>
          Ouvrez le <strong>lien personnel</strong> reçu par e-mail après votre inscription. L’application s’ouvre
          directement, sans mot de passe.
        </p>
        <p class="discret">Lien perdu ? Écrivez à <a href="mailto:secretariat@himmelsweg.fr">secretariat@himmelsweg.fr</a>.</p>
      </section>

      {donnees.mode === 'demo' && (
        <section class="carte">
          <h2>Mode démo : choisir une personne</h2>
          <p class="discret">Pèlerins fictifs, pour voir ce que voit chaque rôle.</p>
          <ul class="personas">
            {donnees.personas.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => donnees.connexionDemo(p.id)}>
                  <strong>{p.nom}</strong>
                  <span>{p.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {donnees.mode !== 'demo' && (
        <button type="button" class="bouton secondaire" onClick={google}>
          Connexion administrateur (Google)
        </button>
      )}
    </div>
  );
}
