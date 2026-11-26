import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { ChampQuestion } from '../composants/champs.jsx';
import { ActiverNotifications, ReglageAlerte } from './equipe.jsx';
import { LIENS, droits, nomRole } from '../donnees/modele.js';
import { enTexte, erreursPersonne, estVisible, questionsTriees, reponsesDe, versFiche } from '../donnees/questionnaire.js';

// Réponses que le pèlerin ne change pas lui-même (identité, documents signés).
const VERROUILLEES = ['prenom', 'nom', 'dateNaissance'];

const estIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
const installee = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

export function Moi({ donnees, session }) {
  const prive = useAbonnement((cb) => (session.estAdmin ? (cb({}), () => {}) : donnees.ecouterPrive(session.id, cb)), [donnees, session.id], null);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], []);
  const d = droits(session);
  const reponses = reponsesDe(session, prive);
  const visibles = questionsTriees(questions).filter((q) => q.type !== 'info' && q.type !== 'signature' && estVisible(q, session.groupe, reponses));
  const roles = (session.roles ?? []).filter((r) => r !== 'pelerin');

  return (
    <>
      <h1>{`${session.prenom ?? ''} ${session.nom ?? ''}`.trim()}</h1>
      <p class="discret">
        {d.admin ? 'Administrateur' : roles.length ? roles.map(nomRole).join(', ') : session.groupe === 'F' ? 'Pèlerine' : 'Pèlerin'}
        {session.chapitre && ` · chapitre ${chapitres.find((c) => c.id === session.chapitre)?.nom ?? ''}`}
      </p>

      <section class="carte">
        <h2>Soutenir le pèlerinage</h2>
        <div class="actions">
          <a class="bouton" href={LIENS.boutique} target="_blank" rel="noopener">
            Boutique
          </a>
          <a class="bouton secondaire" href={LIENS.don} target="_blank" rel="noopener">
            Faire un don
          </a>
        </div>
      </section>

      {roles.length > 0 && (
        <section class="carte">
          <h2>Vos outils d’équipe</h2>
          <p class="discret">{roles.map(nomRole).join(', ')} : retrouvez-les dans l’onglet Équipe.</p>
          <a class="bouton secondaire" href="#/equipe">
            Ouvrir l’onglet Équipe
          </a>
        </section>
      )}

      {!session.estAdmin && <ActiverNotifications donnees={donnees} />}

      {d.admin && (
        <section class="carte">
          <h2>Administration</h2>
          <div class="actions">
            <a class="bouton" href="#/admin/inscriptions">
              Inscriptions et paiements
            </a>
            <a class="bouton secondaire" href="#/admin/organisation">
              Chapitres et équipes
            </a>
            <a class="bouton secondaire" href="#/admin/questionnaire">
              Questionnaire et tarifs
            </a>
            <a class="bouton secondaire" href="#/admin/notification">
              Envoyer une notification
            </a>
          </div>
        </section>
      )}

      {d.admin && <ReglageAlerte donnees={donnees} />}

      {d.admin && (
        <section class="carte">
          <h2>Site internet</h2>
          <p>Les textes et photos de himmelsweg.fr se modifient ici, de préférence sur un ordinateur.</p>
          <div class="actions">
            <a class="bouton secondaire" href="#/admin/site">
              Modifier le site
            </a>
            <a class="lien-bouton" href={LIENS.editeurSite} target="_blank" rel="noopener">
              Ancien éditeur (Pages CMS)
            </a>
          </div>
        </section>
      )}

      {!session.estAdmin && session.statut === 'en_attente' && (
        <p class="encart">Votre inscription attend encore son paiement. Le secrétariat vous a envoyé le lien par e-mail.</p>
      )}

      {!session.estAdmin && prive && !prive.refuse && (
        <section class="carte">
          <h2>Mes informations</h2>
          <dl class="fiche">
            {visibles.map((q) => (
              <Fragment key={q.id}>
                <dt>{q.libelle}</dt>
                <dd>{enTexte(q, reponses[q.id])}</dd>
              </Fragment>
            ))}
          </dl>
          <a class="bouton secondaire" href="#/moi/modifier">
            Modifier mes réponses
          </a>
          <p class="discret">
            Les informations protégées (santé, contacts d’urgence…) sont visibles seulement par les admins, la logistique et
            l’adjoint sécurité de votre chapitre, et effacées après le pèlerinage.
          </p>
        </section>
      )}

      {!installee && (
        <section class="carte">
          <h2>Installer l’app sur le téléphone</h2>
          {estIphone ? (
            <p>
              Dans Safari, touchez le bouton <strong>Partager</strong> (carré avec une flèche), puis{' '}
              <strong>Sur l’écran d’accueil</strong>.
            </p>
          ) : (
            <p>
              Dans Chrome, touchez le menu <strong>⋮</strong> puis <strong>Ajouter à l’écran d’accueil</strong> ou{' '}
              <strong>Installer l’application</strong>.
            </p>
          )}
          <p class="discret">Une fois installée, l’app marche même sans réseau pendant la marche.</p>
        </section>
      )}

      <div class="actions">
        <button type="button" class="bouton secondaire" onClick={() => donnees.deconnexion()}>
          {donnees.mode === 'demo' ? 'Changer de personne' : 'Se déconnecter'}
        </button>
        {donnees.mode === 'demo' && (
          <button type="button" class="lien-bouton" onClick={() => confirm('Remettre les données fictives de départ ?') && donnees.reinitialiser()}>
            Remettre la démo à zéro
          </button>
        )}
      </div>
    </>
  );
}

export function ModifierMesReponses({ donnees, session }) {
  const prive = useAbonnement((cb) => donnees.ecouterPrive(session.id, cb), [donnees, session.id], null);
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], null);
  const [modifs, setModifs] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [msg, setMsg] = useState('');
  if (!prive || !questions) return <p class="discret">Chargement…</p>;

  const reponses = { ...reponsesDe(session, prive), ...modifs };
  const triees = questionsTriees(questions);
  const enregistrer = async (e) => {
    e.preventDefault();
    const err = erreursPersonne(triees, { groupe: session.groupe, reponses });
    setErreurs(err);
    if (Object.keys(err).length) return setMsg('Il manque des réponses : elles sont signalées en rouge.');
    const { membre, prive: p } = versFiche(triees, session.groupe, reponses);
    try {
      await donnees.modifierMesReponses(session.id, { tel: membre.tel ?? '', email: membre.email ?? session.email ?? '', reponses: membre.reponses, volontaireChef: membre.volontaireChef }, p);
      location.hash = '#/moi';
    } catch (er) {
      setMsg(er.message);
    }
  };

  return (
    <form class="formulaire" onSubmit={enregistrer} noValidate>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Modifier mes réponses</h1>
      <p class="discret">Pour changer votre nom ou votre date de naissance, écrivez au secrétariat.</p>
      {msg && <p class="alerte">{msg}</p>}
      {triees
        .filter((q) => q.type !== 'info' && estVisible(q, session.groupe, reponses))
        .map((q) => (
          <ChampQuestion
            key={q.id}
            q={q}
            valeur={reponses[q.id]}
            erreur={erreurs[q.id]}
            verrouille={VERROUILLEES.includes(q.id) || (q.type === 'signature' && !!prive[q.id])}
            changer={(v) => setModifs({ ...modifs, [q.id]: v })}
          />
        ))}
      <div class="actions">
        <button class="bouton">Enregistrer</button>
        <a class="bouton secondaire" href="#/moi">
          Annuler
        </a>
      </div>
    </form>
  );
}
