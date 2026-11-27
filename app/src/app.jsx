import { useEffect, useState } from 'preact/hooks';
import { Icone, useAbonnement, useEnLigne } from './composants/base.jsx';
import logo from './composants/logo.png';
import { droits } from './donnees/modele.js';
import { Connexion } from './ecrans/connexion.jsx';
import { Rubrique } from './ecrans/contenus.jsx';
import { Accueil } from './ecrans/accueil.jsx';
import { FicheMembre, ListeMembres } from './ecrans/membres.jsx';
import { AdminInscriptions, AdminQuestionnaire } from './ecrans/admin.jsx';
import { AdminOrganisation } from './ecrans/organisation.jsx';
import { EnvoiNotification, Equipe, voitEquipe } from './ecrans/equipe.jsx';
import { Moi, ModifierMesReponses } from './ecrans/moi.jsx';

// L'éditeur du site n'est chargé que par les admins qui l'ouvrent.
function EditeurSite(props) {
  const [Ecran, setEcran] = useState(null);
  useEffect(() => {
    import('./ecrans/site.jsx').then((m) => setEcran(() => m.AdminSite));
  }, []);
  return Ecran ? <Ecran {...props} /> : <p class="discret">Chargement…</p>;
}

function useRoute() {
  const lire = () => location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(lire);
  useEffect(() => {
    const maj = () => setRoute(lire());
    addEventListener('hashchange', maj);
    return () => removeEventListener('hashchange', maj);
  }, []);
  return route;
}

export function App({ donnees }) {
  const session = useAbonnement((cb) => donnees.surSession(cb), [donnees], undefined);
  const route = useRoute();
  const enLigne = useEnLigne();
  const [erreurLien, setErreurLien] = useState('');
  const [lienEnCours, setLienEnCours] = useState(false);

  // Arrivée par le lien personnel reçu par e-mail : app.himmelsweg.fr/#cle=...
  useEffect(() => {
    const m = /^cle=(.+)$/.exec(route);
    if (!m) return;
    setLienEnCours(true);
    donnees
      .connexionLien(decodeURIComponent(m[1]))
      .then(() => history.replaceState(null, '', '#/'))
      .catch((e) => setErreurLien(e.message))
      .finally(() => setLienEnCours(false));
  }, [route]);

  if (session === undefined || lienEnCours) return <div class="chargement">Chargement…</div>;
  if (!session || session.refuse) {
    return <Connexion donnees={donnees} erreur={erreurLien || session?.refuse} />;
  }

  const d = droits(session);
  const voitDesPelerins = d.voirTousLesMembres || ['chef', 'securite'].some((r) => session.roles?.includes(r));
  const [page, sous, detail] = route.split('/');
  const onglets = [
    { id: 'accueil', nom: 'Accueil' },
    { id: 'infos', nom: 'Infos' },
    { id: 'prier', nom: 'Prier' },
    ...(voitDesPelerins ? [{ id: 'pelerins', nom: d.voirTousLesMembres ? 'Pèlerins' : 'Chapitre' }] : []),
    ...(voitEquipe(session) ? [{ id: 'equipe', nom: 'Équipe' }] : []),
    { id: 'moi', nom: 'Moi' },
  ];
  const actif = onglets.some((o) => o.id === page) ? page : page === 'admin' && d.admin ? 'moi' : 'accueil';

  let contenu;
  if (page === 'admin' && d.admin) {
    contenu =
      sous === 'questionnaire' ? (
        <AdminQuestionnaire donnees={donnees} />
      ) : sous === 'site' ? (
        <EditeurSite donnees={donnees} />
      ) : sous === 'organisation' ? (
        <AdminOrganisation donnees={donnees} chapitreId={detail} />
      ) : sous === 'notification' ? (
        <EnvoiNotification donnees={donnees} />
      ) : (
        <AdminInscriptions donnees={donnees} />
      );
  } else if (actif === 'moi' && sous === 'modifier' && !session.estAdmin) contenu = <ModifierMesReponses donnees={donnees} session={session} />;
  else if (actif === 'equipe') contenu = <Equipe donnees={donnees} session={session} sous={sous} detail={detail} />;
  else if (actif === 'pelerins' && sous) contenu = <FicheMembre donnees={donnees} session={session} id={sous} />;
  else if (actif === 'pelerins') contenu = <ListeMembres donnees={donnees} session={session} />;
  else if (actif === 'moi') contenu = <Moi donnees={donnees} session={session} />;
  else if (actif === 'infos' || actif === 'prier') contenu = <Rubrique donnees={donnees} session={session} rubrique={actif} ancre={sous} />;
  else contenu = <Accueil donnees={donnees} session={session} />;

  return (
    <div class="coque">
      <header class="entete">
        <a class="marque" href="#/">
          <img src={logo} alt="" width="40" height="40" />
          <span>
            <span class="marque-nom">Himmelsweg</span>
            <span class="marque-sous">7 · 8 · 9 mai 2027</span>
          </span>
        </a>
        {donnees.mode === 'demo' && <span class="badge-demo">Démo</span>}
      </header>
      {!enLigne && (
        <div class="hors-ligne" role="status">
          Hors ligne. Tout ce que vous avez déjà ouvert reste disponible, vos changements partiront au retour du réseau.
        </div>
      )}
      <main class={`page${page === 'admin' && sous === 'site' ? ' large' : ''}`} key={session.id}>
        {contenu}
      </main>
      <nav class="onglets" aria-label="Navigation">
        {onglets.map((o) => (
          <a key={o.id} href={`#/${o.id}`} aria-current={o.id === actif ? 'page' : undefined}>
            <Icone nom={o.id} />
            <span>{o.nom}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
