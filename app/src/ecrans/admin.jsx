// Écrans réservés aux admins : suivi des inscriptions et paiements, éditeur du questionnaire et des tarifs.
import { useMemo, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { CONDITIONS, STATUTS_DOSSIER, TYPES, euros, nomType, questionsTriees } from '../donnees/questionnaire.js';

const dateCourte = (v) => (v ? new Date(v.seconds ? v.seconds * 1000 : v).toLocaleDateString('fr-FR') : '');
const MODES = ['Chèque', 'Espèces', 'Virement', 'Gratuit (décision des responsables)'];

export function AdminInscriptions({ donnees }) {
  const dossiers = useAbonnement((cb) => donnees.ecouterDossiers(cb), [donnees], null);
  const [filtre, setFiltre] = useState('en_attente');
  const [msg, setMsg] = useState('');

  if (dossiers === null) return <p class="discret">Chargement…</p>;
  const temps = (d) => new Date(d.cree?.seconds ? d.cree.seconds * 1000 : d.cree ?? 0).getTime();
  const tries = [...dossiers].sort((a, b) => temps(b) - temps(a));
  const liste = tries.filter((d) => !filtre || (filtre === 'regle' ? d.statut !== 'en_attente' && d.statut !== 'annule' : d.statut === filtre));
  const somme = (f) => dossiers.filter(f).reduce((s, d) => s + (d.montant ?? 0), 0);
  const personnes = (f) => dossiers.filter(f).reduce((s, d) => s + (d.membres?.length ?? 0), 0);
  const attente = (d) => d.statut === 'en_attente';
  const regle = (d) => ['paye', 'gratuit', 'valide_main'].includes(d.statut);

  const valider = async (d, mode) => {
    if (!mode) return;
    if (!confirm(`Valider l’inscription de ${d.noms?.join(', ')} (${mode}) ? Les liens partiront par e-mail.`)) return;
    try {
      await donnees.validerDossier(d.id, mode);
      setMsg(`Inscription de ${d.noms?.join(', ')} validée.${donnees.mode === 'demo' ? '' : ' Les liens partent dans les 15 minutes.'}`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Inscriptions et paiements</h1>
      <div class="chiffres">
        <div>
          <strong>{personnes(regle)}</strong>
          <span>inscrits confirmés</span>
        </div>
        <div>
          <strong>{personnes(attente)}</strong>
          <span>en attente</span>
        </div>
        <div>
          <strong>{euros(somme(regle))}</strong>
          <span>reçus</span>
        </div>
      </div>
      <p class="discret">
        Les inscriptions non payées reçoivent un rappel par e-mail après 3 jours, puis après 10 jours. Un paiement par chèque ou
        en espèces se valide ici : les liens vers l’app partent alors automatiquement.
      </p>
      {msg && (
        <p class="info" role="status">
          {msg}
        </p>
      )}
      <div class="filtres">
        <select value={filtre} onChange={(e) => setFiltre(e.currentTarget.value)} aria-label="Filtre">
          <option value="en_attente">En attente de paiement ({dossiers.filter(attente).length})</option>
          <option value="regle">Réglées ({dossiers.filter(regle).length})</option>
          <option value="">Toutes ({dossiers.length})</option>
        </select>
      </div>
      <ul class="dossiers">
        {liste.map((d) => (
          <li key={d.id} class="carte">
            <div class="dossier-tete">
              <strong>{d.noms?.join(', ')}</strong>
              <span class={`etiquette statut-${d.statut}`}>{STATUTS_DOSSIER[d.statut] ?? d.statut}</span>
            </div>
            <p class="discret">
              {euros(d.montant ?? 0)}
              {d.don ? ` dont ${euros(d.don)} de don` : ''} · le {dateCourte(d.cree)} · payé par {d.payeur?.prenom} {d.payeur?.nom} (
              <a href={`mailto:${d.payeur?.email}`}>{d.payeur?.email}</a>)
              {d.mode && ` · ${d.mode}`}
              {attente(d) && d.relances ? ` · ${d.relances} rappel${d.relances > 1 ? 's' : ''} envoyé${d.relances > 1 ? 's' : ''}` : ''}
            </p>
            {attente(d) && (
              <label class="valider">
                Payé autrement :
                <select value="" onChange={(e) => valider(d, e.currentTarget.value)}>
                  <option value="">Valider à la main…</option>
                  {MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>
      {liste.length === 0 && <p class="discret">Aucune inscription ici.</p>}
    </>
  );
}

export function AdminQuestionnaire({ donnees }) {
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], null);
  const config = useAbonnement((cb) => donnees.ecouterConfig(cb), [donnees], undefined);
  const [edition, setEdition] = useState(null);
  const [msg, setMsg] = useState('');
  const triees = useMemo(() => questionsTriees(questions ?? []), [questions]);

  if (questions === null || config === undefined) return <p class="discret">Chargement…</p>;
  if (!config) return <p class="discret">Le questionnaire s’installe… rechargez la page dans un instant.</p>;
  if (edition) {
    return (
      <EditeurQuestion
        question={edition}
        questions={triees}
        fermer={() => setEdition(null)}
        enregistrer={async (q) => {
          await donnees.enregistrerQuestion(q);
          setEdition(null);
          setMsg('Question enregistrée.');
        }}
        supprimer={async (id) => {
          await donnees.supprimerQuestion(id);
          setEdition(null);
          setMsg('Question supprimée.');
        }}
      />
    );
  }

  const deplacer = async (i, sens) => {
    const l = [...triees];
    [l[i], l[i + sens]] = [l[i + sens], l[i]];
    const renumerotees = l.map((q, k) => ({ ...q, ordre: (k + 1) * 10 }));
    await donnees.enregistrerQuestions(renumerotees);
  };
  const nouvelle = () =>
    setEdition({
      id: `q-${Date.now().toString(36)}`,
      nouvelle: true,
      libelle: '',
      type: 'texte',
      obligatoire: false,
      visibilite: 'equipe',
      groupe: 'tous',
      ordre: (triees.at(-1)?.ordre ?? 0) + 10,
    });

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Questionnaire et tarifs</h1>
      {msg && (
        <p class="info" role="status">
          {msg}
        </p>
      )}
      <Reglages donnees={donnees} config={config} setMsg={setMsg} />

      <section class="carte">
        <h2>Questions</h2>
        <p class="discret">
          Posées à chaque personne inscrite, dans cet ordre. 🔒 = information protégée (santé…), visible seulement des admins, de la
          logistique et de l’adjoint sécurité du chapitre.
        </p>
        <ol class="questions-admin">
          {triees.map((q, i) => (
            <li key={q.id} class={q.actif === false ? 'inactive' : ''}>
              <div class="qa-texte">
                <strong>
                  {q.visibilite === 'sensible' && '🔒 '}
                  {q.libelle || '(sans titre)'}
                </strong>
                <small>
                  {[
                    nomType(q.type),
                    q.obligatoire && q.type !== 'info' ? 'obligatoire' : '',
                    q.groupe === 'H' ? 'hommes seulement' : q.groupe === 'F' ? 'femmes seulement' : '',
                    q.condition?.type ? descriptionCondition(q.condition, triees) : '',
                    q.actif === false ? 'masquée' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <div class="qa-actions">
                <button type="button" class="petit-bouton" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter">
                  ↑
                </button>
                <button type="button" class="petit-bouton" disabled={i === triees.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">
                  ↓
                </button>
                <button type="button" class="bouton petit secondaire" onClick={() => setEdition(q)}>
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
          <a class="bouton secondaire" href={`/inscription${donnees.mode === 'demo' ? '?demo' : ''}`} target="_blank" rel="noopener">
            Voir le formulaire
          </a>
        </div>
      </section>
    </>
  );
}

function descriptionCondition(c, questions) {
  if (c.type === 'mineur') return 'si mineur';
  if (c.type === 'majeur') return 'si majeur';
  if (c.type === 'reponse') {
    const q = questions.find((x) => x.id === c.question);
    return `si « ${q?.libelle ?? '?'} » = ${c.valeur ?? ''}`;
  }
  return '';
}

function Reglages({ donnees, config, setMsg }) {
  const [c, setC] = useState(() => structuredClone(config));
  const modifie = JSON.stringify(c) !== JSON.stringify(config);
  const majTarif = (i, champs) => setC({ ...c, tarifs: c.tarifs.map((t, j) => (j === i ? { ...t, ...champs } : t)) });
  const nombreOuRien = (v) => (v === '' ? null : Number(v));

  const enregistrer = async () => {
    try {
      await donnees.enregistrerConfig({ ...c, tarifs: c.tarifs.filter((t) => t.nom.trim()) });
      setMsg('Réglages enregistrés.');
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <section class="carte">
      <h2>Réglages</h2>
      <label class="case">
        <input type="checkbox" checked={c.ouverte} onChange={(e) => setC({ ...c, ouverte: e.currentTarget.checked })} />
        <span>
          <strong>Inscriptions ouvertes</strong> (décochez pour fermer le formulaire)
        </span>
      </label>
      <label class="case">
        <input type="checkbox" checked={c.don} onChange={(e) => setC({ ...c, don: e.currentTarget.checked })} />
        <span>Proposer un don à la fin de l’inscription</span>
      </label>

      <h3>Tarifs</h3>
      <p class="discret">Âges au 7 mai 2027. Un tarif ne s’affiche qu’aux personnes de l’âge indiqué. Laisser vide = pas de limite.</p>
      <div class="tarifs-admin">
        {c.tarifs.map((t, i) => (
          <div key={t.id} class={`tarif-ligne${t.actif === false ? ' inactive' : ''}`}>
            <label class="tl-nom">
              Nom
              <input value={t.nom} onInput={(e) => majTarif(i, { nom: e.currentTarget.value })} />
            </label>
            <label>
              Prix (€)
              <input type="number" min="0" step="0.5" value={t.montant / 100} onInput={(e) => majTarif(i, { montant: Math.round(Number(e.currentTarget.value) * 100) || 0 })} />
            </label>
            <label>
              Âge min
              <input type="number" min="0" value={t.ageMin ?? ''} onInput={(e) => majTarif(i, { ageMin: nombreOuRien(e.currentTarget.value) })} />
            </label>
            <label>
              Âge max
              <input type="number" min="0" value={t.ageMax ?? ''} onInput={(e) => majTarif(i, { ageMax: nombreOuRien(e.currentTarget.value) })} />
            </label>
            <label class="case">
              <input type="checkbox" checked={t.actif !== false} onChange={(e) => majTarif(i, { actif: e.currentTarget.checked })} />
              Proposé
            </label>
          </div>
        ))}
      </div>
      <button type="button" class="lien-bouton" onClick={() => setC({ ...c, tarifs: [...c.tarifs, { id: `t-${Date.now().toString(36)}`, nom: '', montant: 0, ageMin: null, ageMax: null }] })}>
        + Ajouter un tarif
      </button>

      <label class="champ">
        <span class="libelle">Règlement du pèlerinage</span>
        <small class="aide">Affiché avant le paiement ; chaque inscription doit l’accepter. **gras**, *italique*, listes avec « - ».</small>
        <textarea rows="8" value={c.reglement} onInput={(e) => setC({ ...c, reglement: e.currentTarget.value })} />
      </label>
      <label class="champ">
        <span class="libelle">Lien de la boutique (options payantes)</span>
        <input type="url" value={c.boutique ?? ''} onInput={(e) => setC({ ...c, boutique: e.currentTarget.value })} />
      </label>
      <div class="actions">
        <button type="button" class="bouton" disabled={!modifie} onClick={enregistrer}>
          Enregistrer les réglages
        </button>
        {modifie && (
          <button type="button" class="lien-bouton" onClick={() => setC(structuredClone(config))}>
            Annuler
          </button>
        )}
      </div>
    </section>
  );
}

function EditeurQuestion({ question, questions, fermer, enregistrer, supprimer }) {
  const [q, setQ] = useState(() => ({ groupe: 'tous', ...structuredClone(question), options: question.options ?? [] }));
  const [erreur, setErreur] = useState('');
  const maj = (champs) => setQ({ ...q, ...champs });
  const avecOptions = q.type === 'choix' || q.type === 'choix_multiples';
  const avecTexte = q.type === 'info' || q.type === 'signature' || q.type === 'case';
  const autres = questions.filter((x) => x.id !== q.id && ['choix', 'choix_multiples', 'oui_non', 'case'].includes(x.type));
  const source = autres.find((x) => x.id === q.condition?.question);
  const valeursSource = source ? (source.type === 'oui_non' ? ['Oui', 'Non'] : source.type === 'case' ? [] : source.options ?? []) : [];

  const valider = async (e) => {
    e.preventDefault();
    if (!q.libelle.trim() && q.type !== 'info') return setErreur('Écrivez la question.');
    if (avecOptions && q.options.filter(Boolean).length < 2) return setErreur('Donnez au moins deux choix.');
    if (q.condition?.type === 'reponse' && (!q.condition.question || !q.condition.valeur)) return setErreur('Complétez la condition.');
    const { nouvelle, ...propre } = q;
    if (!avecOptions) delete propre.options;
    else propre.options = q.options.map((o) => o.trim()).filter(Boolean);
    if (!propre.condition?.type) delete propre.condition;
    try {
      await enregistrer(propre);
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <form class="formulaire" onSubmit={valider}>
      <button type="button" class="retour lien-bouton" onClick={fermer}>
        ← Retour aux questions
      </button>
      <h1>{question.nouvelle ? 'Nouvelle question' : 'Modifier la question'}</h1>
      {q.systeme && <p class="info">Question de base de l’app : on peut changer son intitulé et son aide, mais pas la supprimer ni changer son type.</p>}
      {erreur && <p class="alerte">{erreur}</p>}

      <label class="champ">
        <span class="libelle">Type de réponse</span>
        <select value={q.type} disabled={q.systeme} onChange={(e) => maj({ type: e.currentTarget.value })}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </select>
      </label>
      <label class="champ">
        <span class="libelle">{q.type === 'info' ? 'Titre (facultatif)' : q.type === 'case' ? 'Phrase à cocher' : 'Question'}</span>
        <input value={q.libelle} onInput={(e) => maj({ libelle: e.currentTarget.value })} />
      </label>
      {avecTexte && (
        <label class="champ">
          <span class="libelle">{q.type === 'signature' ? 'Texte du document à signer' : q.type === 'case' ? 'Texte affiché au-dessus (facultatif)' : 'Texte d’information'}</span>
          <textarea rows="6" value={q.texte ?? ''} onInput={(e) => maj({ texte: e.currentTarget.value })} />
        </label>
      )}
      {q.type !== 'info' && (
        <label class="champ">
          <span class="libelle">Aide sous la question (facultatif)</span>
          <input value={q.aide ?? ''} onInput={(e) => maj({ aide: e.currentTarget.value })} />
        </label>
      )}
      {avecOptions && (
        <label class="champ">
          <span class="libelle">Choix possibles, un par ligne</span>
          <textarea rows="5" value={q.options.join('\n')} onInput={(e) => maj({ options: e.currentTarget.value.split('\n') })} />
        </label>
      )}
      {!['info', 'case', 'signature'].includes(q.type) && (
        <label class="case">
          <input type="checkbox" checked={q.obligatoire} disabled={q.systeme && ['prenom', 'nom', 'dateNaissance'].includes(q.id)} onChange={(e) => maj({ obligatoire: e.currentTarget.checked })} />
          <span>Réponse obligatoire</span>
        </label>
      )}

      {q.type !== 'info' && (
        <fieldset class="champ">
          <legend class="libelle">Qui voit la réponse ?</legend>
          <div class="pilules">
            {[
              ['equipe', 'Les responsables (fiche du pèlerin)'],
              ['sensible', '🔒 Information protégée'],
            ].map(([v, t]) => (
              <label key={v} class={q.visibilite === v ? 'choisi' : ''}>
                <input type="radio" name="visibilite" checked={q.visibilite === v} disabled={q.systeme} onChange={() => maj({ visibilite: v })} />
                {t}
              </label>
            ))}
          </div>
          <small class="aide">Protégée : admins, logistique et adjoint sécurité du chapitre seulement (santé, contacts, documents signés).</small>
        </fieldset>
      )}

      <fieldset class="champ">
        <legend class="libelle">Pour qui ?</legend>
        <div class="pilules">
          {[
            ['tous', 'Tout le monde'],
            ['H', 'Hommes seulement'],
            ['F', 'Femmes seulement'],
          ].map(([v, t]) => (
            <label key={v} class={(q.groupe ?? 'tous') === v ? 'choisi' : ''}>
              <input type="radio" name="groupe" checked={(q.groupe ?? 'tous') === v} disabled={q.systeme} onChange={() => maj({ groupe: v })} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      {!q.systeme && (
        <label class="champ">
          <span class="libelle">Quand poser la question ?</span>
          <select value={q.condition?.type ?? ''} onChange={(e) => maj({ condition: { type: e.currentTarget.value } })}>
            {CONDITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
      )}
      {q.condition?.type === 'reponse' && (
        <div class="deux">
          <label class="champ">
            <span class="libelle">Question</span>
            <select value={q.condition.question ?? ''} onChange={(e) => maj({ condition: { type: 'reponse', question: e.currentTarget.value, valeur: '' } })}>
              <option value="">Choisir…</option>
              {autres.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.libelle}
                </option>
              ))}
            </select>
          </label>
          <label class="champ">
            <span class="libelle">Réponse</span>
            <select value={q.condition.valeur ?? ''} onChange={(e) => maj({ condition: { ...q.condition, valeur: e.currentTarget.value } })}>
              <option value="">Choisir…</option>
              {valeursSource.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!q.systeme && (
        <label class="case">
          <input type="checkbox" checked={q.actif !== false} onChange={(e) => maj({ actif: e.currentTarget.checked })} />
          <span>Question active (décochez pour la masquer sans perdre les réponses déjà données)</span>
        </label>
      )}

      <div class="actions">
        <button class="bouton">Enregistrer</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
        {!q.systeme && !question.nouvelle && (
          <button type="button" class="lien-bouton danger" onClick={() => confirm('Supprimer cette question ? Les réponses déjà données restent dans les fiches.') && supprimer(q.id)}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
