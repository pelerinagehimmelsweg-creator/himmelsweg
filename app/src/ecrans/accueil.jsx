// Accueil du pèlerin : il change tout seul selon le moment (avant, pendant, après le pèlerinage).
import { useState } from 'preact/hooks';
import photoAccueilF from '../composants/photos/accueil-f.jpg';
import photoAccueilH from '../composants/photos/accueil-h.jpg';
import { useAbonnement } from '../composants/base.jsx';
import { JOURS, aujourdhui, droits, joursAvant, momentDu } from '../donnees/modele.js';
import { lienCarte } from '../donnees/equipes.js';
import { EditeurContenu, TexteAdmin, nouveau, textesDe } from './contenus.jsx';
import { CarteInviter, Soutien } from './soutien.jsx';
import { CarteBilan } from './bilan.jsx';

const CLE_FAIT = 'himmelsweg-a-faire';
const lireFaits = () => {
  try {
    return JSON.parse(localStorage.getItem(CLE_FAIT) || '{}');
  } catch {
    return {};
  }
};
const installee = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const notifsActives = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';

/** La liste « À faire avant le départ ». Certaines cases se cochent toutes seules. */
const A_FAIRE = [
  { id: 'installer', texte: 'Installer l’app sur votre téléphone', lien: '#/moi', auto: installee },
  { id: 'notifications', texte: 'Activer les notifications', lien: '#/moi', auto: notifsActives },
  { id: 'infos', texte: 'Vérifier vos informations', lien: '#/moi' },
  { id: 'sac', texte: 'Préparer votre sac', lien: '#/infos/c-affaires' },
  { id: 'transport', texte: 'Prévoir votre transport jusqu’à Scherwiller', lien: '#/infos/c-transport' },
  { id: 'spirituel', texte: 'Vous préparer spirituellement', lien: '#/infos/c-spirituel' },
];

export function Accueil({ donnees, session }) {
  const contenus = useAbonnement((cb) => donnees.ecouterContenus(cb), [donnees], null);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const [edition, setEdition] = useState(null);
  const d = droits(session);
  // Les admins peuvent voir l'accueil tel qu'il sera pendant ou après le pèlerinage.
  const [apercu, setApercu] = useState('');
  const moment = apercu || momentDu();

  if (edition) return <EditeurContenu donnees={donnees} contenu={edition} fermer={() => setEdition(null)} />;

  const chapitre = chapitres.find((c) => c.id === session.chapitre);
  const textes = (r) =>
    textesDe(contenus, r).map((c) => <TexteAdmin key={c.id} c={c} peutModifier={d.modifierContenus} modifier={() => setEdition(c)} />);
  const ajouter = (r, libelle) =>
    d.modifierContenus && (
      <button type="button" class="lien-bouton" onClick={() => setEdition(nouveau(r, textesDe(contenus, r)))}>
        {libelle}
      </button>
    );

  return (
    <>
      {d.admin && (
        <label class="apercu-moment">
          Voir l’accueil des pèlerins :
          <select value={apercu} onChange={(e) => setApercu(e.currentTarget.value)}>
            <option value="">aujourd’hui</option>
            <option value="avant">avant le pèlerinage</option>
            <option value="pendant">pendant le pèlerinage</option>
            <option value="apres">après le pèlerinage</option>
          </select>
        </label>
      )}
      <div class="accueil-photo">
        <img src={session.groupe === 'H' ? photoAccueilH : photoAccueilF} alt="" />
        <h1>{session.prenom ? `Bienvenue, ${session.prenom}` : 'Bienvenue'}</h1>
      </div>

      {moment === 'avant' && <CompteARebours />}
      {session.statut === 'en_attente' && (
        <p class="encart attente">
          Votre inscription attend encore son paiement. Le lien de paiement vous a été envoyé par e-mail. Une question ? Écrivez
          à <a href="mailto:secretariat@himmelsweg.fr">secretariat@himmelsweg.fr</a>.
        </p>
      )}

      {(moment !== 'avant' || donnees.mode === 'demo') && <CarteBilan donnees={donnees} session={session} force={apercu === 'apres' && d.admin} />}

      {moment === 'pendant' && <Pendant donnees={donnees} contenus={contenus} />}

      {moment !== 'apres' && !session.estAdmin && <MonInscription session={session} chapitre={chapitre} />}

      {moment === 'avant' && (
        <>
          {!session.estAdmin && <AFaire />}
          {!session.estAdmin && <CarteInviter session={session} />}
          {textes('accueil')}
          {ajouter('accueil', 'Ajouter un mot sur l’accueil')}
          <Soutien donnees={donnees} />
        </>
      )}

      {moment === 'pendant' && <Soutien donnees={donnees} />}

      {moment === 'apres' && (
        <>
          <p class="intro-apres">Merci d’avoir marché avec nous sur le chemin du Ciel !</p>
          <Soutien donnees={donnees} forme="merci" />
          <a class="encart lien-encart" href="#/photos">
            <span>Les photos du pèlerinage : voir la galerie et déposer les vôtres</span>
            <span aria-hidden="true">›</span>
          </a>
          {textes('apres')}
          {ajouter('apres', 'Ajouter un texte pour l’après-pèlerinage')}
        </>
      )}
    </>
  );
}

function CompteARebours() {
  const n = joursAvant();
  return (
    <div class="compte-a-rebours">
      <strong>{n > 1 ? `J-${n}` : n === 1 ? 'Demain !' : 'C’est aujourd’hui !'}</strong>
      <span>
        {n > 1 ? `Plus que ${n} jours avant le départ` : 'Le départ approche'}
        <br />
        Vendredi 7, samedi 8 et dimanche 9 mai 2027
      </span>
    </div>
  );
}

function MonInscription({ session, chapitre }) {
  const confirmee = session.statut !== 'en_attente';
  return (
    <section class="carte">
      <h2>Mon inscription</h2>
      <dl class="fiche">
        <dt>Inscription</dt>
        <dd>{confirmee ? <span class="ok">✓ Confirmée</span> : <span class="etiquette attente">Paiement en attente</span>}</dd>
        <dt>Chapitre</dt>
        <dd>{chapitre?.nom ?? <span class="discret">Attribué prochainement</span>}</dd>
        {chapitre && (
          <>
            <dt>Chef de chapitre</dt>
            <dd>{chapitre.chef ?? <span class="discret">Bientôt connu</span>}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function AFaire() {
  const [faits, setFaits] = useState(lireFaits);
  const fait = (t) => (t.auto?.() ? true : !!faits[t.id]);
  const basculer = (t) => {
    const n = { ...faits, [t.id]: !faits[t.id] };
    setFaits(n);
    try {
      localStorage.setItem(CLE_FAIT, JSON.stringify(n));
    } catch {
      // sans stockage : la case reste cochée jusqu'à la fermeture de l'app
    }
  };
  const nb = A_FAIRE.filter(fait).length;
  return (
    <section class="carte">
      <div class="carte-titre">
        <h2>À faire avant le départ</h2>
        <span class="discret">
          {nb} sur {A_FAIRE.length}
        </span>
      </div>
      <div class="barre-progression" role="progressbar" aria-valuenow={nb} aria-valuemax={A_FAIRE.length}>
        <span style={{ width: `${(100 * nb) / A_FAIRE.length}%` }} />
      </div>
      <ul class="a-faire">
        {A_FAIRE.map((t) => (
          <li key={t.id} class={fait(t) ? 'fait' : ''}>
            <input type="checkbox" checked={fait(t)} disabled={!!t.auto?.()} onChange={() => basculer(t)} aria-label={t.texte} />
            <a href={t.lien}>{t.texte}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pendant({ donnees, contenus }) {
  const etapes = useAbonnement((cb) => donnees.ecouterListe('parcours', cb), [donnees], []);
  const jour = JOURS[aujourdhui()] ?? JOURS['2027-05-07'];
  const duJour = etapes.filter((e) => e.jour === jour).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const urgences = textesDe(contenus, 'infos').find((c) => /urgence/i.test(c.titre));
  return (
    <>
      <a class="bouton urgence" href="tel:112">
        Appeler les secours (112)
      </a>
      <section class="carte">
        <h2>Aujourd’hui · {jour}</h2>
        {duJour.length ? (
          <ol class="etapes">
            {duJour.map((e) => (
              <li key={e.id}>
                <div class="etape-tete">
                  <strong>{e.titre}</strong>
                  {e.heure && <span class="heure">{e.heure}</span>}
                </div>
                {e.lieu && <small>{e.lieu}</small>}
                {e.notes && <small>{e.notes}</small>}
                {e.adresse && (
                  <a href={lienCarte(e.adresse)} target="_blank" rel="noopener">
                    Ouvrir la carte
                  </a>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p class="discret">Le programme du jour sera affiché ici.</p>
        )}
      </section>
      <div class="raccourcis">
        <a class="tuile" href="#/prier">
          <strong>Prier</strong>
          <span>Chants et prières</span>
        </a>
        <a class="tuile" href="#/photos">
          <strong>Photos</strong>
          <span>Déposer, voir la galerie</span>
        </a>
        <a class="tuile" href="#/carte">
          <strong>Carte</strong>
          <span>Parcours et repères</span>
        </a>
        <a class="tuile" href={urgences ? `#/infos/${urgences.id}` : '#/infos'}>
          <strong>Urgences</strong>
          <span>Numéros utiles</span>
        </a>
      </div>
    </>
  );
}
