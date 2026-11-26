import { useAbonnement } from '../composants/base.jsx';
import { LIENS, droits, nomRole } from '../donnees/modele.js';

const estIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
const installee = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

export function Moi({ donnees, session }) {
  const prive = useAbonnement((cb) => (session.estAdmin ? (cb({}), () => {}) : donnees.ecouterPrive(session.id, cb)), [donnees, session.id], null);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const d = droits(session);
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
          <p class="discret">
            Les écrans {roles.map(nomRole).join(', ')} (repas, parcours, alertes, messagerie) arrivent dans la
            prochaine version de l’app.
          </p>
        </section>
      )}

      {d.admin && (
        <section class="carte">
          <h2>Site internet</h2>
          <p>Les textes et photos de himmelsweg.fr se modifient dans l’éditeur du site.</p>
          <a class="bouton secondaire" href={LIENS.editeurSite} target="_blank" rel="noopener">
            Ouvrir l’éditeur du site
          </a>
        </section>
      )}

      {!session.estAdmin && prive && !prive.refuse && (
        <section class="carte">
          <h2>Mes informations</h2>
          <dl class="fiche">
            <dt>Téléphone</dt>
            <dd>{session.tel || '—'}</dd>
            <dt>Contact d’urgence</dt>
            <dd>
              {prive.urgenceNom || '—'} {prive.urgenceTel}
            </dd>
            <dt>Santé</dt>
            <dd>{prive.sante || 'Rien de signalé'}</dd>
            <dt>Régime alimentaire</dt>
            <dd>{prive.regime || 'Aucun'}</dd>
          </dl>
          <p class="discret">
            Une erreur ? Écrivez à <a href="mailto:secretariat@himmelsweg.fr">secretariat@himmelsweg.fr</a>. Ces
            informations sont visibles seulement par les admins, la logistique et l’adjoint sécurité de votre
            chapitre, et effacées après le pèlerinage.
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
