// Onglet « Équipe » : outils des équipes repas, logistique, chefs et adjoints sécurité.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { droits } from '../donnees/modele.js';
import { FILS, UNITES, filsDe, lienCarte, lienSms, listeDeCourses } from '../donnees/equipes.js';
import { MARQUEUR_PRENOM, MODELES_NOTIFICATION, notificationAffichee, personnaliser, quandNotification } from '../donnees/notifications.js';
import { Banniere, useAffiche } from '../composants/banniere.jsx';

const a = (session, ...roles) => session.estAdmin || roles.some((r) => session.roles?.includes(r));
export const aDesOutils = (session) => a(session, 'repas', 'logistique', 'chef', 'securite');
const heure = (iso) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export function Equipe({ donnees, session, sous, detail }) {
  if (sous === 'repas' && a(session, 'repas')) return <Repas donnees={donnees} />;
  if (sous === 'parcours' && a(session, 'logistique', 'chef', 'securite')) return <Parcours donnees={donnees} session={session} />;
  if (sous === 'prevoyance' && a(session, 'logistique')) return <Prevoyance donnees={donnees} />;
  if (sous === 'fil' && filsDe(session).some((f) => f.id === detail)) return <Fil donnees={donnees} session={session} equipe={detail} />;
  if (sous === 'alerte' && a(session, 'securite')) return <Alerte donnees={donnees} />;
  if (sous === 'alertes') return <Alertes donnees={donnees} session={session} />;
  return <Accueil donnees={donnees} session={session} />;
}

function Retour() {
  return (
    <a class="retour" href="#/equipe">
      ← Équipe
    </a>
  );
}

function Accueil({ donnees, session }) {
  const alertes = useAbonnement((cb) => (a(session, 'logistique') ? donnees.ecouterAlertes(cb) : (cb([]), () => {})), [donnees, session.id], []);
  const ouvertes = alertes.filter((x) => !x.traitee).length;
  const tuile = (href, titre, texte) => (
    <a class="tuile" href={href} key={href}>
      <strong>{titre}</strong>
      <span>{texte}</span>
    </a>
  );
  return (
    <>
      <h1>Équipe</h1>
      {ouvertes > 0 && (
        <a class="encart alerte-encart" href="#/equipe/alertes">
          {ouvertes} alerte{ouvertes > 1 ? 's' : ''} accident en cours
        </a>
      )}
      {a(session, 'securite') && (
        <a class="bouton urgence" href="#/equipe/alerte">
          Alerte accident
        </a>
      )}
      <div class="tuiles">
        {a(session, 'repas') && tuile('#/equipe/repas', 'Repas', 'Nombre par régime, quantités, fournisseurs')}
        {a(session, 'logistique', 'chef', 'securite') && tuile('#/equipe/parcours', 'Parcours', 'Étapes, horaires, rendez-vous')}
        {a(session, 'logistique') && tuile('#/equipe/prevoyance', 'Prévoyance', 'Matériel à prévoir, qui s’en charge')}
        {a(session, 'logistique') && tuile('#/equipe/alertes', 'Alertes', 'Accidents signalés par les adjoints sécurité')}
        {!session.estAdmin && a(session, 'chef', 'securite') && tuile('#/pelerins', 'Mon chapitre', session.roles?.includes('chef') ? 'Liste, téléphones, adjoint sécurité' : 'Liste et téléphones')}
      </div>
      <h2>Discussions</h2>
      <div class="tuiles">
        {filsDe(session).map((f) => tuile(`#/equipe/fil/${f.id}`, f.nom, 'Fil de l’équipe'))}
      </div>
    </>
  );
}

/* ---------------- Repas ---------------- */

function Repas({ donnees }) {
  const config = useAbonnement((cb) => donnees.ecouterRepas(cb), [donnees], undefined);
  const stats = useAbonnement((cb) => donnees.ecouterStatsRepas(cb), [donnees], undefined);
  const [edition, setEdition] = useState(null);
  const [msg, setMsg] = useState('');
  if (config === undefined || stats === undefined) return <p class="discret">Chargement…</p>;
  if (!config) return <p class="discret">Réservé à l’équipe repas.</p>;

  const regimes = Object.entries(stats?.parRegime ?? {}).sort((x, y) => y[1] - x[1]);
  const courses = listeDeCourses(config, stats);
  const sauver = async (c) => {
    try {
      await donnees.enregistrerRepas(c);
      setMsg('Enregistré.');
    } catch (e) {
      setMsg(e.message);
    }
  };
  const nomRepas = (id) => config.repas.find((r) => r.id === id)?.nom ?? id;

  if (edition) {
    return (
      <EditeurArticle
        article={edition}
        config={config}
        regimes={regimes.map(([r]) => r)}
        fermer={() => setEdition(null)}
        enregistrer={async (art) => {
          await sauver({ ...config, articles: [...config.articles.filter((x) => x.id !== art.id), art] });
          setEdition(null);
        }}
        supprimer={async (id) => {
          await sauver({ ...config, articles: config.articles.filter((x) => x.id !== id) });
          setEdition(null);
        }}
      />
    );
  }

  return (
    <>
      <Retour />
      <h1>Repas</h1>
      {msg && <p class="info">{msg}</p>}
      <section class="carte">
        <h2>Combien de personnes ?</h2>
        <div class="chiffres">
          <div>
            <strong>{stats?.total ?? 0}</strong>
            <span>pèlerins inscrits</span>
          </div>
          <div>
            <strong>{Number(config.extras) || 0}</strong>
            <span>encadrants et autres</span>
          </div>
          <div>
            <strong>{(stats?.total ?? 0) + (Number(config.extras) || 0)}</strong>
            <span>au total</span>
          </div>
        </div>
        <table class="tableau">
          <thead>
            <tr>
              <th>Régime</th>
              <th>Pèlerins</th>
            </tr>
          </thead>
          <tbody>
            {regimes.map(([r, n]) => (
              <tr key={r}>
                <td>{r}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <label class="champ ligne">
          <span class="libelle">Encadrants et personnes non inscrites qui mangent</span>
          <input type="number" min="0" value={config.extras ?? 0} onChange={(e) => sauver({ ...config, extras: Math.max(0, Number(e.currentTarget.value) || 0) })} />
        </label>
        <p class="discret">
          Seuls les inscrits dont le paiement est confirmé comptent. Les noms ne sont pas visibles par l’équipe repas.
          {stats?.maj && ` Mis à jour ${heure(stats.maj.seconds ? stats.maj.seconds * 1000 : stats.maj)}.`}
        </p>
      </section>

      <section class="carte">
        <h2>Liste de courses</h2>
        <p class="discret">Repas comptés : {config.repas.map((r) => r.nom).join(', ')}.</p>
        <ul class="courses">
          {courses.map((c) => (
            <li key={c.id}>
              <button type="button" class="lien-ligne" onClick={() => setEdition(c)}>
                <span>
                  <strong>{c.nom}</strong>
                  <small>
                    {c.parPersonne} {c.unite} × {c.personnes} pers.{c.pour ? ` (${c.pour})` : ''} × {c.nbRepas} repas · {c.repas.map(nomRepas).join(', ')}
                  </small>
                </span>
                <strong class="quantite">{c.texte}</strong>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          class="bouton secondaire"
          onClick={() => setEdition({ id: `a-${Date.now().toString(36)}`, nom: '', unite: 'g', parPersonne: 0, repas: [], pour: '', nouveau: true })}
        >
          + Ajouter un article
        </button>
      </section>

      <Fournisseurs donnees={donnees} />
    </>
  );
}

function EditeurArticle({ article, config, regimes, fermer, enregistrer, supprimer }) {
  const [x, setX] = useState(() => ({ ...article }));
  const maj = (c) => setX({ ...x, ...c });
  const basculerRepas = (id) => maj({ repas: x.repas.includes(id) ? x.repas.filter((r) => r !== id) : [...x.repas, id] });
  return (
    <form
      class="formulaire"
      onSubmit={(e) => {
        e.preventDefault();
        if (!x.nom.trim()) return;
        const { nouveau, personnes, nbRepas, quantite, texte, ...propre } = x;
        enregistrer({ ...propre, nom: x.nom.trim(), parPersonne: Number(x.parPersonne) || 0 });
      }}
    >
      <button type="button" class="retour lien-bouton" onClick={fermer}>
        ← Repas
      </button>
      <h1>{article.nouveau ? 'Nouvel article' : x.nom}</h1>
      <label>
        Article
        <input value={x.nom} required onInput={(e) => maj({ nom: e.currentTarget.value })} placeholder="Ex. : pâtes, pain, café" />
      </label>
      <div class="deux">
        <label>
          Quantité par personne et par repas
          <input type="number" min="0" step="any" value={x.parPersonne} onInput={(e) => maj({ parPersonne: e.currentTarget.value })} />
        </label>
        <label>
          Unité
          <select value={x.unite} onChange={(e) => maj({ unite: e.currentTarget.value })}>
            {UNITES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset class="champ">
        <legend class="libelle">Pour quels repas ?</legend>
        <div class="cases">
          {config.repas.map((r) => (
            <label key={r.id} class="case">
              <input type="checkbox" checked={x.repas.includes(r.id)} onChange={() => basculerRepas(r.id)} />
              {r.nom}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Pour qui ?
        <select value={x.pour} onChange={(e) => maj({ pour: e.currentTarget.value })}>
          <option value="">Tout le monde (avec les encadrants)</option>
          {[...new Set([...regimes, 'Végétarien', 'Sans gluten', 'Sans lactose'])]
            .filter((r) => r !== 'Aucun' && r !== 'Non précisé')
            .map((r) => (
              <option key={r} value={r}>
                Seulement : {r}
              </option>
            ))}
        </select>
      </label>
      <div class="actions">
        <button class="bouton">Enregistrer</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
        {!article.nouveau && (
          <button type="button" class="lien-bouton danger" onClick={() => confirm('Supprimer cet article ?') && supprimer(x.id)}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------------- Listes modifiables (fournisseurs, parcours, prévoyance) ---------------- */

function useListe(donnees, nom) {
  return useAbonnement((cb) => donnees.ecouterListe(nom, cb), [donnees, nom], null);
}

function FormulaireElement({ titre, champs, element, enregistrer, supprimer, fermer }) {
  const [x, setX] = useState(() => ({ ...element }));
  return (
    <form
      class="carte formulaire edition"
      onSubmit={async (e) => {
        e.preventDefault();
        await enregistrer(x);
      }}
    >
      <h2>{titre}</h2>
      {champs.map(([k, libelle, type = 'text']) => (
        <label key={k}>
          {libelle}
          {type === 'textarea' ? (
            <textarea rows="3" value={x[k] ?? ''} onInput={(e) => setX({ ...x, [k]: e.currentTarget.value })} />
          ) : (
            <input type={type} value={x[k] ?? ''} onInput={(e) => setX({ ...x, [k]: type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value })} />
          )}
        </label>
      ))}
      <div class="actions">
        <button class="bouton petit">Enregistrer</button>
        <button type="button" class="bouton petit secondaire" onClick={fermer}>
          Annuler
        </button>
        {element.id && (
          <button type="button" class="lien-bouton danger" onClick={() => confirm('Supprimer ?') && supprimer(element.id)}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

function Fournisseurs({ donnees }) {
  const liste = useListe(donnees, 'fournisseurs');
  const [edition, setEdition] = useState(null);
  if (!liste) return null;
  const champs = [
    ['nom', 'Nom'],
    ['tel', 'Téléphone', 'tel'],
    ['livre', 'Ce qu’il livre'],
    ['quand', 'Quand'],
    ['prix', 'Prix'],
  ];
  return (
    <section class="carte">
      <h2>Fournisseurs</h2>
      {edition ? (
        <FormulaireElement
          titre={edition.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          champs={champs}
          element={edition}
          fermer={() => setEdition(null)}
          enregistrer={async (x) => {
            await donnees.enregistrerElement('fournisseurs', x);
            setEdition(null);
          }}
          supprimer={async (id) => {
            await donnees.supprimerElement('fournisseurs', id);
            setEdition(null);
          }}
        />
      ) : (
        <>
          <ul class="elements">
            {[...liste]
              .sort((x, y) => (x.nom ?? '').localeCompare(y.nom ?? '', 'fr'))
              .map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.nom}</strong>
                    {f.tel && (
                      <>
                        {' · '}
                        <a href={`tel:${f.tel.replace(/\s/g, '')}`}>{f.tel}</a>
                      </>
                    )}
                    <small>{[f.livre, f.quand, f.prix].filter(Boolean).join(' · ')}</small>
                  </div>
                  <button type="button" class="bouton petit secondaire" onClick={() => setEdition(f)}>
                    Modifier
                  </button>
                </li>
              ))}
          </ul>
          <button type="button" class="lien-bouton" onClick={() => setEdition({})}>
            + Ajouter un fournisseur
          </button>
        </>
      )}
    </section>
  );
}

function Parcours({ donnees, session }) {
  const liste = useListe(donnees, 'parcours');
  const [edition, setEdition] = useState(null);
  const peut = a(session, 'logistique');
  if (!liste) return <p class="discret">Chargement…</p>;
  const tries = [...liste].sort((x, y) => (x.ordre ?? 0) - (y.ordre ?? 0));
  const jours = [...new Set(tries.map((e) => e.jour || 'Sans date'))];
  const champs = [
    ['jour', 'Jour (ex. : Vendredi 7 mai)'],
    ['heure', 'Heure'],
    ['titre', 'Étape'],
    ['lieu', 'Lieu de rendez-vous'],
    ['adresse', 'Adresse (pour la carte)'],
    ['notes', 'Remarques', 'textarea'],
    ['ordre', 'Ordre', 'number'],
  ];
  return (
    <>
      <Retour />
      <h1>Parcours</h1>
      <p class="discret">En attendant le tracé GPS : les étapes, les horaires et les rendez-vous.{peut ? ' Touchez une étape pour la modifier.' : ''}</p>
      {edition && (
        <FormulaireElement
          titre={edition.id ? 'Modifier l’étape' : 'Nouvelle étape'}
          champs={champs}
          element={edition}
          fermer={() => setEdition(null)}
          enregistrer={async (x) => {
            await donnees.enregistrerElement('parcours', x);
            setEdition(null);
          }}
          supprimer={async (id) => {
            await donnees.supprimerElement('parcours', id);
            setEdition(null);
          }}
        />
      )}
      {jours.map((j) => (
        <section class="carte" key={j}>
          <h2>{j}</h2>
          <ol class="etapes">
            {tries
              .filter((e) => (e.jour || 'Sans date') === j)
              .map((e) => (
                <li key={e.id}>
                  <div class="etape-tete">
                    <strong>
                      {e.heure && <span class="heure">{e.heure}</span>} {e.titre}
                    </strong>
                    {peut && (
                      <button type="button" class="lien-bouton" onClick={() => setEdition(e)}>
                        Modifier
                      </button>
                    )}
                  </div>
                  {e.lieu && (
                    <div>
                      {e.adresse ? (
                        <a href={lienCarte(e.adresse)} target="_blank" rel="noopener">
                          {e.lieu} (carte)
                        </a>
                      ) : (
                        e.lieu
                      )}
                    </div>
                  )}
                  {e.notes && <small>{e.notes}</small>}
                </li>
              ))}
          </ol>
        </section>
      ))}
      {peut && !edition && (
        <button type="button" class="bouton secondaire" onClick={() => setEdition({ ordre: (tries.at(-1)?.ordre ?? 0) + 1, jour: tries.at(-1)?.jour ?? '' })}>
          + Ajouter une étape
        </button>
      )}
    </>
  );
}

function Prevoyance({ donnees }) {
  const liste = useListe(donnees, 'prevoyance');
  const [edition, setEdition] = useState(null);
  if (!liste) return <p class="discret">Chargement…</p>;
  const tries = [...liste].sort((x, y) => Number(!!x.fait) - Number(!!y.fait) || (x.objet ?? '').localeCompare(y.objet ?? '', 'fr'));
  const restants = liste.filter((x) => !x.fait).length;
  return (
    <>
      <Retour />
      <h1>Prévoyance</h1>
      <p class="discret">
        {restants} chose{restants > 1 ? 's' : ''} à prévoir sur {liste.length}.
      </p>
      {edition && (
        <FormulaireElement
          titre={edition.id ? 'Modifier' : 'À prévoir'}
          champs={[
            ['objet', 'Matériel'],
            ['quantite', 'Quantité'],
            ['responsable', 'Qui s’en charge'],
          ]}
          element={edition}
          fermer={() => setEdition(null)}
          enregistrer={async (x) => {
            await donnees.enregistrerElement('prevoyance', { fait: false, ...x });
            setEdition(null);
          }}
          supprimer={async (id) => {
            await donnees.supprimerElement('prevoyance', id);
            setEdition(null);
          }}
        />
      )}
      <ul class="elements carte">
        {tries.map((p) => (
          <li key={p.id} class={p.fait ? 'fait' : ''}>
            <label class="case">
              <input type="checkbox" checked={!!p.fait} onChange={(e) => donnees.enregistrerElement('prevoyance', { ...p, fait: e.currentTarget.checked })} />
              <span>
                <strong>{p.objet}</strong>
                {p.quantite && ` × ${p.quantite}`}
                <small>{p.responsable ? `Qui : ${p.responsable}` : 'Personne pour l’instant'}</small>
              </span>
            </label>
            <button type="button" class="lien-bouton" onClick={() => setEdition(p)}>
              Modifier
            </button>
          </li>
        ))}
      </ul>
      {!edition && (
        <button type="button" class="bouton secondaire" onClick={() => setEdition({})}>
          + Ajouter
        </button>
      )}
    </>
  );
}

/* ---------------- Discussions ---------------- */

function Fil({ donnees, session, equipe }) {
  const messages = useAbonnement((cb) => donnees.ecouterFil(equipe, cb), [donnees, equipe], null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');
  const bas = useRef(null);
  useEffect(() => bas.current?.scrollIntoView({ block: 'end' }), [messages?.length]);
  const nom = FILS.find((f) => f.id === equipe)?.nom;
  const envoyer = async (e) => {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setTexte('');
    try {
      await donnees.ecrireFil(equipe, t);
      setErreur('');
    } catch (er) {
      setErreur(er.message);
      setTexte(t);
    }
  };
  return (
    <>
      <Retour />
      <h1>{nom}</h1>
      <p class="discret">Visible par toute l’équipe {nom?.toLowerCase()} et les admins.</p>
      <ul class="fil">
        {(messages ?? []).map((m) => (
          <li key={m.id} class={m.auteur === session.id ? 'moi' : ''}>
            <small>
              {m.auteur === session.id ? 'Vous' : m.nom} · {heure(m.le)}
            </small>
            <p>{m.texte}</p>
          </li>
        ))}
        {messages?.length === 0 && <li class="discret vide">Pas encore de message.</li>}
      </ul>
      <div ref={bas} />
      {erreur && <p class="alerte">{erreur}</p>}
      <form class="ecrire" onSubmit={envoyer}>
        <textarea rows="2" value={texte} placeholder="Écrire à l’équipe…" onInput={(e) => setTexte(e.currentTarget.value)} />
        <button class="bouton">Envoyer</button>
      </form>
    </>
  );
}

/* ---------------- Alertes ---------------- */

function position() {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function Alerte({ donnees }) {
  const config = useAbonnement((cb) => donnees.ecouterConfigApp(cb), [donnees], {});
  const [message, setMessage] = useState('');
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');

  const lancer = async () => {
    setEtat({ enCours: true });
    setErreur('');
    try {
      const pos = await position();
      const r = await donnees.lancerAlerte({ message: message.trim(), position: pos });
      setEtat({ ...r, position: pos });
      if (config.smsAlerte) location.href = lienSms(config.smsAlerte, r.texte);
    } catch (e) {
      setErreur(e.message);
      setEtat(null);
    }
  };

  return (
    <>
      <Retour />
      <h1>Alerte accident</h1>
      <p class="carte urgence-112">
        Urgence vitale : appelez d’abord le <a href="tel:112">112</a>.
      </p>
      {etat && !etat.enCours ? (
        <section class="carte">
          <h2>Alerte envoyée</h2>
          <p>
            La logistique est prévenue dans l’app
            {etat.prevenus != null ? ` (${etat.prevenus} téléphone${etat.prevenus > 1 ? 's' : ''} notifié${etat.prevenus > 1 ? 's' : ''})` : ''}.
            {etat.position ? ' Votre position est jointe.' : ' Position introuvable : précisez le lieu par téléphone.'}
          </p>
          {config.smsAlerte ? (
            <a class="bouton" href={lienSms(config.smsAlerte, etat.texte)}>
              Envoyer le SMS d’alerte
            </a>
          ) : (
            <p class="discret">Le numéro d’alerte SMS n’est pas encore renseigné par les admins.</p>
          )}
        </section>
      ) : (
        <section class="carte">
          <label class="champ">
            <span class="libelle">Que se passe-t-il ? (facultatif)</span>
            <textarea rows="3" value={message} placeholder="Ex. : chute, cheville tordue, au km 12" onInput={(e) => setMessage(e.currentTarget.value)} />
          </label>
          {erreur && <p class="alerte">{erreur}</p>}
          <button type="button" class="bouton urgence" disabled={etat?.enCours} onClick={lancer}>
            {etat?.enCours ? 'Envoi…' : 'Lancer l’alerte'}
          </button>
          <p class="discret">
            L’alerte prévient la logistique avec votre position
            {config.smsAlerte ? `, puis ouvre un SMS prêt à envoyer au ${config.smsAlerte}` : ''}.
          </p>
        </section>
      )}
    </>
  );
}

function Alertes({ donnees, session }) {
  const alertes = useAbonnement((cb) => donnees.ecouterAlertes(cb), [donnees, session.id], null);
  const peut = a(session, 'logistique');
  if (!alertes) return <p class="discret">Chargement…</p>;
  const triees = [...alertes].sort((x, y) => String(y.le).localeCompare(String(x.le)));
  return (
    <>
      <Retour />
      <h1>Alertes</h1>
      {triees.length === 0 && <p class="discret">Aucune alerte. Tant mieux !</p>}
      <ul class="dossiers">
        {triees.map((al) => (
          <li key={al.id} class={`carte${al.traitee ? '' : ' sensible'}`}>
            <div class="dossier-tete">
              <strong>{al.nom}</strong>
              <span class={`etiquette ${al.traitee ? 'statut-paye' : 'attente'}`}>{al.traitee ? 'Traitée' : 'En cours'}</span>
            </div>
            <p class="discret">
              {heure(al.le)}
              {al.chapitre && ` · chapitre ${al.chapitre}`}
            </p>
            {al.message && <p>{al.message}</p>}
            <div class="actions">
              {al.position && (
                <a class="bouton petit secondaire" href={`https://maps.google.com/?q=${al.position.lat},${al.position.lng}`} target="_blank" rel="noopener">
                  Voir sur la carte
                </a>
              )}
              {peut && !al.traitee && (
                <button type="button" class="bouton petit" onClick={() => donnees.traiterAlerte(al.id)}>
                  Marquer traitée
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- Admin : notifications ---------------- */

export function EnvoiNotification({ donnees }) {
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const programmees = useAbonnement((cb) => donnees.ecouterProgrammees(cb), [donnees], []);
  const [f, setF] = useState({ cible: 'tous', valeur: '', titre: '', texte: '', modele: 'annonce', quand: 'maintenant', le: '' });
  const [vue, setVue] = useState('android');
  const [etat, setEtat] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const ROLES_CIBLES = [
    ['chef', 'Chefs de chapitre'],
    ['securite', 'Adjoints sécurité'],
    ['logistique', 'Logistique'],
    ['repas', 'Équipe repas'],
    ['chorale', 'Chorale'],
  ];
  const n = notificationAffichee(f);
  const nomCible = (p) =>
    p.cible === 'tous' ? 'Tous les inscrits' : p.cible === 'moi' ? 'Moi (essai)' : p.cible === 'chapitre' ? (chapitres.find((c) => c.id === p.valeur)?.nom ?? 'Un chapitre') : (ROLES_CIBLES.find(([v]) => v === p.valeur)?.[1] ?? p.valeur);
  const envoyer = async (e) => {
    e.preventDefault();
    if (!f.titre.trim() || !f.texte.trim()) return setEtat('Écrivez un titre et un message.');
    if (f.cible === 'chapitre' || f.cible === 'role') if (!f.valeur) return setEtat('Choisissez à qui envoyer.');
    const message = { cible: f.cible, valeur: f.valeur, titre: f.titre.trim(), texte: f.texte.trim(), modele: f.modele };
    setEnvoi(true);
    try {
      if (f.quand === 'programmer') {
        const le = new Date(f.le);
        if (!f.le || isNaN(le) || le < Date.now()) throw new Error('Choisissez une date et une heure à venir.');
        await donnees.programmerNotification({ ...message, le: le.toISOString() });
        setEtat(`Programmée pour ${quandNotification(le.toISOString())}. Elle partira à 15 minutes près.`);
      } else {
        const r = await donnees.envoyerNotification(message);
        setEtat(
          r.demo
            ? `Démo : le message partirait vers ${r.envoyes} personne${r.envoyes > 1 ? 's' : ''}. La bannière en haut montre ce que voient ceux qui ont l’app ouverte.`
            : `Envoyé sur ${r.envoyes} téléphone${r.envoyes > 1 ? 's' : ''}.${r.sansNotification ? ` ${r.sansNotification} personne${r.sansNotification > 1 ? 's n’ont' : ' n’a'} pas activé les notifications.` : ''}`,
        );
      }
      setF({ ...f, titre: '', texte: '' });
    } catch (er) {
      setEtat(er.message);
    }
    setEnvoi(false);
  };
  const aVenir = programmees.filter((p) => !p.envoyee).sort((a, b) => a.le.localeCompare(b.le));
  const parties = programmees.filter((p) => p.envoyee).sort((a, b) => b.le.localeCompare(a.le)).slice(0, 5);
  return (
    <form class="formulaire" onSubmit={envoyer}>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Envoyer une notification</h1>
      <p class="discret">Le message s’affiche sur les téléphones qui ont activé les notifications. Il n’est pas gardé dans l’app.</p>
      {etat && <p class="info">{etat}</p>}

      <fieldset class="champ">
        <legend class="libelle">Modèle</legend>
        <div class="modeles-notif">
          {Object.entries(MODELES_NOTIFICATION).map(([id, m]) => (
            <label key={id} class={f.modele === id ? 'choisi' : ''}>
              <input type="radio" name="modele" checked={f.modele === id} onChange={() => setF({ ...f, modele: id })} />
              <span class="mn-photo" style={{ backgroundImage: `url(/notifications/${id}.jpg)` }} />
              <span class="mn-nom">
                {m.symbole} {m.nom}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div class="deux">
        <label>
          À qui ?
          <select value={f.cible} onChange={(e) => setF({ ...f, cible: e.currentTarget.value, valeur: '' })}>
            <option value="tous">Tous les inscrits</option>
            <option value="chapitre">Un chapitre</option>
            <option value="role">Une équipe</option>
            <option value="moi">Moi seulement (essai)</option>
          </select>
        </label>
        {(f.cible === 'chapitre' || f.cible === 'role') && (
          <label>
            {f.cible === 'chapitre' ? 'Chapitre' : 'Équipe'}
            <select value={f.valeur} onChange={(e) => setF({ ...f, valeur: e.currentTarget.value })}>
              <option value="">Choisir…</option>
              {f.cible === 'chapitre'
                ? chapitres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))
                : ROLES_CIBLES.map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
            </select>
          </label>
        )}
      </div>
      {f.cible === 'moi' && <small class="aide">Pour voir le rendu sur votre téléphone : activez d’abord les notifications dans Moi.</small>}
      <label>
        Titre
        <input id="notif-titre" maxLength="60" value={f.titre} onInput={(e) => setF({ ...f, titre: e.currentTarget.value })} placeholder="Ex. : {prénom}, rendez-vous à 7 h 30" />
      </label>
      <BoutonPrenom champ="notif-titre" valeur={f.titre} changer={(titre) => setF({ ...f, titre })} />
      <label>
        Message
        <textarea id="notif-texte" rows="3" maxLength="300" value={f.texte} onInput={(e) => setF({ ...f, texte: e.currentTarget.value })} />
      </label>
      <BoutonPrenom champ="notif-texte" valeur={f.texte} changer={(texte) => setF({ ...f, texte })} />
      <small class="aide">« {MARQUEUR_PRENOM} » est remplacé par le prénom de chaque pèlerin (Anne, Paul…).</small>

      <section class="apercu-notif">
        <div class="onglets-internes" role="tablist">
          {[
            ['android', 'Android'],
            ['iphone', 'iPhone'],
            ['app', 'App ouverte'],
          ].map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={vue === v} class={vue === v ? 'actif' : ''} onClick={() => setVue(v)}>
              {t}
            </button>
          ))}
        </div>
        <ApercuNotification n={{ ...n, titre: personnaliser(f.titre, 'Anne') || 'Votre titre', texte: personnaliser(f.texte, 'Anne') || 'Votre message s’affichera ici.' }} vue={vue} />
        {/\{pr[ée]nom\}/i.test(f.titre + f.texte) && <small class="aide">Aperçu pour une pèlerine prénommée Anne.</small>}
      </section>

      <fieldset class="champ">
        <legend class="libelle">Quand ?</legend>
        <div class="pilules">
          {[
            ['maintenant', 'Maintenant'],
            ['programmer', 'Programmer'],
          ].map(([v, t]) => (
            <label key={v} class={f.quand === v ? 'choisi' : ''}>
              <input type="radio" name="quand" checked={f.quand === v} onChange={() => setF({ ...f, quand: v })} />
              {t}
            </label>
          ))}
        </div>
        {f.quand === 'programmer' && (
          <input type="datetime-local" value={f.le} onInput={(e) => setF({ ...f, le: e.currentTarget.value })} aria-label="Date et heure d’envoi" />
        )}
      </fieldset>
      <button class="bouton" disabled={envoi}>
        {envoi ? 'Envoi…' : f.quand === 'programmer' ? 'Programmer' : 'Envoyer'}
      </button>

      {aVenir.length > 0 && (
        <section class="carte programmees">
          <h2>Programmées</h2>
          <ul>
            {aVenir.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>
                    {MODELES_NOTIFICATION[p.modele]?.symbole} {p.titre}
                  </strong>
                  <small>
                    {quandNotification(p.le)} · {nomCible(p)}
                  </small>
                </span>
                <button type="button" class="lien-bouton danger" onClick={() => confirm('Annuler cette notification ?') && donnees.annulerProgrammee(p.id)}>
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {parties.length > 0 && (
        <section class="carte programmees">
          <h2>Déjà parties</h2>
          <ul>
            {parties.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>
                    {MODELES_NOTIFICATION[p.modele]?.symbole} {p.titre}
                  </strong>
                  <small>
                    {quandNotification(p.le)} · {nomCible(p)}
                    {p.envoyes != null ? ` · ${p.envoyes} téléphone${p.envoyes > 1 ? 's' : ''}` : ''}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}

/** Insère « {prénom} » là où se trouve le curseur (au début d'un titre : « {prénom}, »). */
function BoutonPrenom({ champ, valeur, changer }) {
  const inserer = () => {
    const el = document.getElementById(champ);
    const v = valeur ?? '';
    // Curseur placé dans le texte : on insère là ; sinon début du titre ou fin du message.
    const debut = el && document.activeElement === el && el.selectionStart < v.length ? el.selectionStart : null;
    if (debut === null) {
      changer(v ? (champ === 'notif-titre' ? `${MARQUEUR_PRENOM}, ${v.charAt(0).toLowerCase()}${v.slice(1)}` : `${v.replace(/\s+$/, '')} ${MARQUEUR_PRENOM}`) : `${MARQUEUR_PRENOM}, `);
    } else {
      const avant = v.slice(0, debut);
      changer(avant + (avant && !/\s$/.test(avant) ? ' ' : '') + MARQUEUR_PRENOM + v.slice(el.selectionEnd));
    }
  };
  return (
    <button type="button" class="lien-bouton bouton-prenom" onMouseDown={(e) => e.preventDefault()} onClick={inserer}>
      + Prénom
    </button>
  );
}

/** Aperçu de la notification, comme sur un téléphone. */
function ApercuNotification({ n, vue }) {
  if (vue === 'app') return <div class="ecran-apercu clair"><Banniere n={n} apercu /></div>;
  if (vue === 'iphone') {
    return (
      <div class="ecran-apercu" style={{ backgroundImage: `url(${n.image})` }}>
        <div class="notif-ios">
          <img src="/icone-192.png" alt="" />
          <div>
            <small>maintenant</small>
            <strong>
              {n.symbole} {n.titre}
            </strong>
            <span>{n.texte}</span>
          </div>
        </div>
        <p class="apercu-note">Sur iPhone, Apple n’affiche que l’icône, le titre et le texte.</p>
      </div>
    );
  }
  return <ApercuAndroid n={n} />;
}

function ApercuAndroid({ n }) {
  const image = useAffiche(n);
  return (
    <div class="ecran-apercu" style={{ backgroundImage: `url(${n.image})` }}>
      <div class="notif-android">
        <div class="na-tete">
          <img src="/notifications/badge.png" alt="" />
          Himmelsweg · maintenant
        </div>
        <strong>
          {n.symbole} {n.titre}
        </strong>
        <span>{n.texte}</span>
        <div class="na-photo" style={{ backgroundImage: `url(${image})` }} />
        {n.lien !== '/#/' && (
          <div class="na-actions">
            <span>{n.bouton}</span>
            <span>Ouvrir</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Numéro d'alerte SMS, saisi par les admins (dans Moi). */
export function ReglageAlerte({ donnees }) {
  const config = useAbonnement((cb) => donnees.ecouterConfigApp(cb), [donnees], null);
  const [num, setNum] = useState(null);
  const [msg, setMsg] = useState('');
  if (!config) return null;
  const valeur = num ?? config.smsAlerte ?? '';
  return (
    <section class="carte">
      <h2>Numéro d’alerte SMS</h2>
      <p class="discret">L’alerte accident des adjoints sécurité ouvre un SMS prêt à envoyer à ce numéro, avec leur position.</p>
      <div class="lien-perso">
        <input type="tel" value={valeur} placeholder="06 …" onInput={(e) => setNum(e.currentTarget.value)} />
        <button
          type="button"
          class="bouton petit"
          onClick={async () => {
            await donnees.enregistrerConfigApp({ ...config, smsAlerte: valeur.trim() });
            setMsg('Enregistré.');
          }}
        >
          Enregistrer
        </button>
      </div>
      {msg && <p class="info">{msg}</p>}
    </section>
  );
}

/** Bouton « Activer les notifications » (dans Moi). */
export function ActiverNotifications({ donnees }) {
  const [msg, setMsg] = useState('');
  if (donnees.notifications === 'absent') return null;
  const deja = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  return (
    <section class="carte">
      <h2>Notifications</h2>
      <p class="discret">Pour recevoir sur ce téléphone les messages des responsables{deja ? ' (déjà autorisées ici)' : ''}.</p>
      <button
        type="button"
        class="bouton secondaire"
        onClick={() =>
          donnees
            .activerNotifications()
            .then(setMsg)
            .catch((e) => setMsg(e.message))
        }
      >
        {deja ? 'Réactiver les notifications' : 'Activer les notifications'}
      </button>
      {msg && <p class="info">{msg}</p>}
    </section>
  );
}

export const voitEquipe = (session) => droits(session).admin || aDesOutils(session);
