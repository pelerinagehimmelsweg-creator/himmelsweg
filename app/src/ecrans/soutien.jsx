// Boutique et don (pages HelloAsso), sur l'accueil et dans Moi. Liens modifiables par les admins.
import { useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { LIENS } from '../donnees/modele.js';

const lien = (config, k) => (config?.[k] || '').trim() || LIENS[k];
const ouvrir = { target: '_blank', rel: 'noopener' };

/**
 * forme : 'discret' (avant et pendant le pèlerinage), 'merci' (après : le don bien en avant), 'moi'.
 */
export function Soutien({ donnees, forme = 'discret' }) {
  const config = useAbonnement((cb) => donnees.ecouterConfigApp(cb), [donnees], {});
  const boutique = lien(config, 'boutique');
  const don = lien(config, 'don');

  if (forme === 'merci') {
    return (
      <section class="carte soutien-merci">
        <h2>Soutenir le pèlerinage</h2>
        <p>
          Himmelsweg vit grâce à la générosité de chacun. Votre don aide à préparer le prochain pèlerinage.
        </p>
        <div class="actions">
          <a class="bouton" href={don} {...ouvrir}>
            Faire un don
          </a>
          <a class="bouton secondaire" href={boutique} {...ouvrir}>
            Boutique
          </a>
        </div>
        <p class="discret petit-texte">Paiement sécurisé sur HelloAsso.</p>
      </section>
    );
  }
  return (
    <section class="carte">
      <h2>{forme === 'moi' ? 'Soutenir le pèlerinage' : 'Boutique du pèlerinage'}</h2>
      {forme !== 'moi' && <p class="discret">Souvenirs et options du pèlerinage, sur HelloAsso.</p>}
      <div class="actions">
        <a class="bouton" href={boutique} {...ouvrir}>
          {forme === 'moi' ? 'Boutique' : 'Voir la boutique'}
        </a>
        <a class={forme === 'moi' ? 'bouton secondaire' : 'lien-bouton'} href={don} {...ouvrir}>
          Faire un don
        </a>
      </div>
    </section>
  );
}

/** Réglage des deux liens, pour les admins (dans Moi). */
export function ReglageSoutien({ donnees }) {
  const config = useAbonnement((cb) => donnees.ecouterConfigApp(cb), [donnees], null);
  const [v, setV] = useState({});
  const [msg, setMsg] = useState('');
  if (!config) return null;
  const val = (k) => v[k] ?? config[k] ?? '';
  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await donnees.enregistrerConfigApp({ ...config, boutique: val('boutique').trim(), don: val('don').trim() });
      setMsg('Enregistré.');
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <form class="carte formulaire" onSubmit={enregistrer}>
      <h2>Boutique et don</h2>
      <p class="discret">Adresses des pages HelloAsso ouvertes par les boutons « Boutique » et « Faire un don ». Laissez vide pour la page habituelle.</p>
      <label>
        Boutique
        <input type="url" value={val('boutique')} placeholder={LIENS.boutique} onInput={(e) => setV({ ...v, boutique: e.currentTarget.value })} />
      </label>
      <label>
        Don
        <input type="url" value={val('don')} placeholder={LIENS.don} onInput={(e) => setV({ ...v, don: e.currentTarget.value })} />
      </label>
      <div class="actions">
        <button class="bouton petit">Enregistrer</button>
        {msg && <span class="discret">{msg}</span>}
      </div>
    </form>
  );
}
