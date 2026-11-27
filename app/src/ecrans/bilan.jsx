// Questionnaire de fin : le pèlerin répond (anonyme s'il le veut), les admins règlent les questions et lisent les résultats.
import { useMemo, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { ChampQuestion } from '../composants/champs.jsx';
import { TYPES_BILAN, bilanOuvert, csvBilan, erreursBilan, questionsBilan, reponseBilan, resultatsBilan } from '../donnees/bilan.js';
import { aujourdhui } from '../donnees/modele.js';
import { estVisible, nomType } from '../donnees/questionnaire.js';
import { EditeurQuestion } from './admin.jsx';

const useConfigBilan = (donnees) => useAbonnement((cb) => donnees.ecouterConfigBilan(cb), [donnees], null);
const ouvertPour = (donnees, config) => donnees.mode === 'demo' || bilanOuvert(config);

/** Carte « Votre avis compte » sur l'accueil, tant que le pèlerin n'a pas répondu. */
export function CarteBilan({ donnees, session, force = false }) {
  const config = useConfigBilan(donnees);
  const fait = useAbonnement((cb) => donnees.ecouterMonBilan(cb), [donnees], true);
  if (!config || (!force && (!ouvertPour(donnees, config) || fait || session.estAdmin))) return null;
  return (
    <a class="carte carte-bilan" href="#/bilan">
      <span>
        <strong>Votre avis compte</strong>
        <small>3 minutes pour nous aider à préparer le prochain pèlerinage</small>
      </span>
      <span class="bouton petit">Répondre</span>
    </a>
  );
}

export function Bilan({ donnees, session }) {
  const config = useConfigBilan(donnees);
  const fait = useAbonnement((cb) => donnees.ecouterMonBilan(cb), [donnees], null);
  const admin = !!session.estAdmin;
  const groupe = admin ? 'F' : session.groupe;
  const [reponses, setReponses] = useState({});
  const [temoignage, setTemoignage] = useState('');
  const [publier, setPublier] = useState(true);
  const [anonyme, setAnonyme] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [msg, setMsg] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (!config || fait === null) return <p class="discret">Chargement…</p>;
  const questions = questionsBilan(config);
  const retour = (
    <a class="lien-retour" href={admin ? '#/admin/bilan' : '#/'}>
      ‹ {admin ? 'Résultats' : 'Accueil'}
    </a>
  );

  if (!admin && fait) {
    return (
      <>
        {retour}
        <div class="merci-bilan">
          <span aria-hidden="true">🙏</span>
          <h1>Merci !</h1>
          <p>Votre avis est bien arrivé. Il aidera les organisateurs à préparer le prochain pèlerinage.</p>
          <a class="bouton secondaire" href="#/photos">
            Voir les photos
          </a>
        </div>
      </>
    );
  }
  if (!admin && !ouvertPour(donnees, config)) {
    return (
      <>
        {retour}
        <h1>Votre avis</h1>
        <p class="encart">Le questionnaire ouvrira le dimanche 9 mai au soir, à la fin du pèlerinage.</p>
      </>
    );
  }

  const envoyer = async (e) => {
    e.preventDefault();
    if (admin) return setMsg('Aperçu : les admins ne répondent pas au questionnaire.');
    const err = erreursBilan(questions, groupe, reponses);
    if (anonyme === null) err.anonyme = 'Choisissez comment envoyer vos réponses.';
    setErreurs(err);
    if (Object.keys(err).length) {
      document.querySelector(`[data-champ="${Object.keys(err)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEnvoi(true);
    setMsg('');
    try {
      await donnees.envoyerBilan(reponseBilan({ questions, session, reponses, anonyme, temoignage, publier, jour: aujourdhui() }));
    } catch (err2) {
      setMsg(err2.message);
    }
    setEnvoi(false);
  };

  return (
    <form class="formulaire bilan" onSubmit={envoyer} noValidate>
      {retour}
      <h1>Votre avis</h1>
      <p class="discret">
        {admin
          ? 'Aperçu du questionnaire tel que les pèlerins le voient.'
          : 'Merci d’avoir marché avec nous ! Trois minutes pour nous dire ce qui vous a plu et ce que nous pouvons améliorer.'}
      </p>
      {questions
        .filter((q) => estVisible(q, groupe, reponses))
        .map((q) => (
          <ChampQuestion key={q.id} q={q} valeur={reponses[q.id]} erreur={erreurs[q.id]} changer={(v) => setReponses({ ...reponses, [q.id]: v })} />
        ))}

      <section class="carte temoignage">
        <h2>Votre témoignage</h2>
        <p class="discret">Facultatif. Quelques lignes sur ce que vous avez vécu, pour donner envie à d’autres de venir.</p>
        <textarea rows="4" maxLength={2000} value={temoignage} onInput={(e) => setTemoignage(e.currentTarget.value)} aria-label="Votre témoignage" />
        {temoignage.trim() && (
          <label class="case">
            <input type="checkbox" checked={publier} onChange={(e) => setPublier(e.currentTarget.checked)} />
            <span>J’accepte qu’il soit publié (site, invitations), signé {anonyme ? (groupe === 'H' ? '« Un pèlerin »' : '« Une pèlerine »') : 'de mon prénom'}.</span>
          </label>
        )}
      </section>

      <fieldset class={`champ${erreurs.anonyme ? ' en-erreur' : ''}`} data-champ="anonyme">
        <legend class="libelle">Envoyer mes réponses</legend>
        <div class="pilules">
          {[
            [false, 'Avec mon nom'],
            [true, 'Anonymement'],
          ].map(([v, t]) => (
            <label key={t} class={anonyme === v ? 'choisi' : ''}>
              <input type="radio" name="anonyme" checked={anonyme === v} onChange={() => setAnonyme(v)} />
              {t}
            </label>
          ))}
        </div>
        <small class="aide">Anonyme : les organisateurs savent seulement que vous avez répondu, pas ce que vous avez écrit.</small>
        {erreurs.anonyme && (
          <small class="erreur" role="alert">
            {erreurs.anonyme}
          </small>
        )}
      </fieldset>

      {msg && <p class="info">{msg}</p>}
      <button class="bouton large" disabled={envoi}>
        {envoi ? 'Envoi…' : 'Envoyer mon avis'}
      </button>
    </form>
  );
}

/* ---------------- Admins ---------------- */

export function AdminBilan({ donnees }) {
  const config = useConfigBilan(donnees);
  const bilans = useAbonnement((cb) => donnees.ecouterBilans(cb), [donnees], null);
  const faits = useAbonnement((cb) => donnees.ecouterBilansFaits(cb), [donnees], []);
  const membres = useAbonnement((cb) => donnees.ecouterMembres(cb), [donnees], []);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const [vue, setVue] = useState('resultats');
  const [edition, setEdition] = useState(null);
  const questions = useMemo(() => questionsBilan(config), [config]);
  const res = useMemo(() => resultatsBilan(questions, bilans ?? [], membres, chapitres, faits), [questions, bilans, membres, chapitres, faits]);

  if (!config || bilans === null) return <p class="discret">Chargement…</p>;
  const sauverQuestions = (l) => donnees.enregistrerConfigBilan({ questions: l.map((q, k) => ({ ...q, ordre: (k + 1) * 10 })) });

  if (edition) {
    return (
      <EditeurQuestion
        question={edition}
        questions={questions}
        types={TYPES_BILAN}
        bilan
        fermer={() => setEdition(null)}
        enregistrer={async (q) => {
          await sauverQuestions(questions.some((x) => x.id === q.id) ? questions.map((x) => (x.id === q.id ? q : x)) : [...questions, q]);
          setEdition(null);
        }}
        supprimer={async (id) => {
          await sauverQuestions(questions.filter((x) => x.id !== id));
          setEdition(null);
        }}
      />
    );
  }

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Questionnaire de fin</h1>
      <div class="onglets-internes" role="tablist">
        {[
          ['resultats', 'Résultats'],
          ['temoignages', 'Témoignages'],
          ['questions', 'Questions'],
        ].map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={vue === v} class={vue === v ? 'actif' : ''} onClick={() => setVue(v)}>
            {t}
          </button>
        ))}
      </div>
      {vue === 'resultats' && <Resultats res={res} bilans={bilans} questions={questions} />}
      {vue === 'temoignages' && <Temoignages donnees={donnees} bilans={bilans} />}
      {vue === 'questions' && <Questions donnees={donnees} config={config} questions={questions} modifier={setEdition} sauver={sauverQuestions} />}
    </>
  );
}

function Resultats({ res, bilans, questions }) {
  const taux = res.inscrits ? Math.round((res.repondu / res.inscrits) * 100) : 0;
  const exporter = () => {
    const url = URL.createObjectURL(new Blob([csvBilan(questions, bilans)], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: 'questionnaire-himmelsweg.csv' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const notes = res.parQuestion.filter((x) => x.moyenne !== undefined);
  return (
    <>
      <div class="chiffres">
        <div>
          <strong>{res.reponses}</strong>
          <span>réponses</span>
        </div>
        <div>
          <strong>{taux} %</strong>
          <span>
            des {res.inscrits} inscrits
          </span>
        </div>
      </div>
      {res.reponses === 0 && <p class="discret">Aucune réponse pour le moment.</p>}

      {notes.length > 0 && res.reponses > 0 && (
        <section class="carte">
          <h2>Notes</h2>
          <ul class="barres">
            {notes.map(({ q, moyenne, n }) => (
              <li key={q.id}>
                <span class="barre-titre">
                  {q.libelle}
                  <small>{n} avis</small>
                </span>
                <span class="barre">
                  <span style={{ width: `${((moyenne ?? 0) / 5) * 100}%` }} />
                </span>
                <strong class="barre-valeur">{moyenne === null ? '—' : `${moyenne.toFixed(1).replace('.', ',')} ★`}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {res.parQuestion
        .filter((x) => x.options && x.n)
        .map(({ q, options, comptes, n }) => (
          <section key={q.id} class="carte">
            <h2>{q.libelle}</h2>
            <ul class="barres">
              {options.map((o, k) => (
                <li key={o}>
                  <span class="barre-titre">{o}</span>
                  <span class="barre">
                    <span style={{ width: `${(comptes[k] / n) * 100}%` }} />
                  </span>
                  <strong class="barre-valeur">{Math.round((comptes[k] / n) * 100)} %</strong>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <section class="carte">
        <h2>Réponses par chapitre</h2>
        <table class="tableau">
          <tbody>
            {res.parChapitre.map((c) => (
              <tr key={c.nom}>
                <td>{c.nom}</td>
                <td class="nombre">
                  {c.repondu} / {c.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {res.parQuestion
        .filter((x) => x.textes?.length)
        .map(({ q, textes }) => (
          <details key={q.id} class="carte commentaires">
            <summary>
              {q.libelle} <span class="discret">({textes.length})</span>
            </summary>
            <ul>
              {textes.map((t, k) => (
                <li key={k}>
                  {t.texte}
                  <small>{t.qui}</small>
                </li>
              ))}
            </ul>
          </details>
        ))}

      {res.reponses > 0 && (
        <button type="button" class="bouton secondaire" onClick={exporter}>
          Télécharger pour un tableur
        </button>
      )}
    </>
  );
}

function Temoignages({ donnees, bilans }) {
  const liste = bilans.filter((b) => b.temoignage).sort((a, b) => (b.retenu ? 1 : 0) - (a.retenu ? 1 : 0));
  const [copie, setCopie] = useState('');
  if (!liste.length) return <p class="discret">Aucun témoignage pour le moment.</p>;
  const copier = async (b) => {
    await navigator.clipboard?.writeText(`« ${b.temoignage} »\n${b.signature ?? ''}`).catch(() => {});
    setCopie(b.id);
  };
  return (
    <>
      <p class="discret">Retenez les plus beaux pour le site ou l’invitation de l’an prochain. Seuls ceux dont l’auteur a accepté la publication peuvent être retenus.</p>
      {liste.map((b) => (
        <blockquote key={b.id} class={`carte temoignage-admin${b.retenu ? ' retenu' : ''}`}>
          <p>« {b.temoignage} »</p>
          <footer>
            <span>
              {b.signature}
              {!b.anonyme && b.nom && <small> ({b.nom})</small>}
            </span>
            {b.publier ? (
              <span class="actions">
                <button type="button" class={`bouton petit${b.retenu ? '' : ' secondaire'}`} onClick={() => donnees.retenirTemoignage(b.id, !b.retenu)}>
                  {b.retenu ? '★ Retenu' : '☆ Retenir'}
                </button>
                {b.retenu && (
                  <button type="button" class="lien-bouton" onClick={() => copier(b)}>
                    {copie === b.id ? 'Copié' : 'Copier'}
                  </button>
                )}
              </span>
            ) : (
              <span class="etiquette">Ne pas publier</span>
            )}
          </footer>
        </blockquote>
      ))}
    </>
  );
}

function Questions({ donnees, config, questions, modifier, sauver }) {
  const ouverture = config.ouverture ?? 'auto';
  const deplacer = (i, sens) => {
    const l = [...questions];
    [l[i], l[i + sens]] = [l[i + sens], l[i]];
    sauver(l);
  };
  const nouvelle = () =>
    modifier({ id: `b-${Date.now().toString(36)}`, nouvelle: true, libelle: '', type: 'note', obligatoire: false, groupe: 'tous', ordre: 9999 });
  return (
    <>
      <section class="carte formulaire">
        <h2>Ouverture</h2>
        <select value={ouverture} onChange={(e) => donnees.enregistrerConfigBilan({ ouverture: e.currentTarget.value })} aria-label="Ouverture du questionnaire">
          <option value="auto">Automatique : dimanche 9 mai, 19 h</option>
          <option value="ouvert">Ouvert maintenant</option>
          <option value="ferme">Fermé</option>
        </select>
        <small class="aide">
          À l’ouverture, chaque pèlerin reçoit une notification. Trois jours plus tard, une relance part à ceux qui n’ont pas répondu.
        </small>
      </section>
      <section class="carte">
        <h2>Questions</h2>
        <ol class="questions-admin">
          {questions.map((q, i) => (
            <li key={q.id} class={q.actif === false ? 'inactive' : ''}>
              <div class="qa-texte">
                <strong>{q.libelle || '(sans titre)'}</strong>
                <small>
                  {[nomType(q.type) === q.type ? TYPES_BILAN.find((t) => t.id === q.type)?.nom : nomType(q.type), q.obligatoire ? 'obligatoire' : '', q.groupe === 'H' ? 'hommes seulement' : q.groupe === 'F' ? 'femmes seulement' : '', q.actif === false ? 'masquée' : '']
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <div class="qa-actions">
                <button type="button" class="petit-bouton" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter">
                  ↑
                </button>
                <button type="button" class="petit-bouton" disabled={i === questions.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">
                  ↓
                </button>
                <button type="button" class="bouton petit secondaire" onClick={() => modifier(q)}>
                  Modifier
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div class="actions">
          <button type="button" class="bouton" onClick={nouvelle}>
            + Ajouter une question
          </button>
          <a class="bouton secondaire" href="#/bilan">
            Voir le questionnaire
          </a>
        </div>
      </section>
    </>
  );
}
