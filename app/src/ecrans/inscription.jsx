// Inscription publique : app.himmelsweg.fr/inscription
// Choix Homme / Femme, questionnaire (modifiable par les admins), tarif, don, puis paiement HelloAsso.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Texte, useAbonnement } from '../composants/base.jsx';
import { ChampQuestion } from '../composants/champs.jsx';
import { AccueilInvite, CarteAnimee } from '../composants/accueil-invite.jsx';
import { joursAvant } from '../donnees/modele.js';
import logo from '../composants/logo.png';
import { ageDe, erreursPersonne, estVisible, euros, questionsTriees, tarifsPour, totalPanier } from '../donnees/questionnaire.js';

const BROUILLON = 'himmelsweg-inscription-brouillon';
const enDemo = () => new URLSearchParams(location.search).has('demo');
/** Adresse interne de l'inscription, en gardant le mode démo s'il est actif. */
export const lienInscription = (chemin, params = {}) => {
  const p = new URLSearchParams(params);
  if (enDemo()) p.set('demo', '');
  const q = p.toString().replace(/demo=(&|$)/, 'demo$1');
  return `/inscription${chemin}${q ? `?${q}` : ''}`;
};

const personneVide = () => ({ cle: Math.random().toString(36).slice(2), groupe: '', tarif: '', reponses: {} });

function lireBrouillon() {
  try {
    const b = JSON.parse(localStorage.getItem(BROUILLON));
    if (b?.personnes?.length) return b;
  } catch {}
  return { personnes: [personneVide()], payeur: { prenom: '', nom: '', email: '', tel: '' }, don: 0, reglement: false };
}

export function Inscription({ donnees }) {
  const chemin = location.pathname.replace(/\/+$/, '');
  const ref = new URLSearchParams(location.search).get('ref');
  let contenu;
  if (chemin.endsWith('/merci') && ref) contenu = <Merci donnees={donnees} ref_={ref} />;
  else if (chemin.endsWith('/payer') && ref) contenu = <Payer donnees={donnees} ref_={ref} />;
  else if (chemin.endsWith('/demo-paiement') && ref && donnees.simulerPaiement) contenu = <PaiementDemo donnees={donnees} ref_={ref} />;
  else contenu = <Formulaire donnees={donnees} />;
  return (
    <div class="coque publique">
      <header class="entete">
        <a class="marque" href="https://himmelsweg.fr/">
          <img src={logo} alt="" width="40" height="40" />
          <span>
            <span class="marque-nom">Himmelsweg</span>
            <span class="marque-sous">7 · 8 · 9 mai 2027</span>
          </span>
        </a>
        {donnees.mode === 'demo' && <span class="badge-demo">Démo</span>}
      </header>
      <main class="page">{contenu}</main>
    </div>
  );
}

// Arrivée par l'invitation d'un ami : ?invite=<pèlerin>&de=<prénom>, gardé si la page est rechargée.
const CLE_INVITE = 'himmelsweg-invite';
function lireInvitation() {
  const p = new URLSearchParams(location.search);
  if (p.get('invite')) {
    const i = { id: p.get('invite').slice(0, 60), de: (p.get('de') ?? '').slice(0, 40) };
    try {
      localStorage.setItem(CLE_INVITE, JSON.stringify(i));
    } catch {}
    return i;
  }
  try {
    return JSON.parse(localStorage.getItem(CLE_INVITE) || 'null');
  } catch {
    return null;
  }
}

function Formulaire({ donnees }) {
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], null);
  const config = useAbonnement((cb) => donnees.ecouterConfig(cb), [donnees], undefined);
  const [f, setF] = useState(lireBrouillon);
  const [erreurs, setErreurs] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [donLibre, setDonLibre] = useState(false);
  const [invitation] = useState(lireInvitation);
  // L'accueil animé ne se joue qu'en arrivant par le lien (pas à chaque rechargement).
  const [accueil, setAccueil] = useState(() => {
    if (!new URLSearchParams(location.search).get('invite')) return false;
    try {
      if (sessionStorage.getItem('himmelsweg-accueil-vu')) return false;
    } catch {}
    return true;
  });
  const fermerAccueil = () => {
    try {
      sessionStorage.setItem('himmelsweg-accueil-vu', '1');
    } catch {}
    setAccueil(false);
    scrollTo(0, 0);
  };

  useEffect(() => {
    try {
      localStorage.setItem(BROUILLON, JSON.stringify(f));
    } catch {}
  }, [f]);

  const triees = useMemo(() => questionsTriees(questions ?? []), [questions]);
  if (questions === null || config === undefined) return <p class="discret">Chargement…</p>;
  if (!config || !config.ouverte) {
    return (
      <section class="carte">
        <h1>Inscriptions</h1>
        <p>Les inscriptions ne sont pas ouvertes pour le moment. Revenez bientôt, ou écrivez à <a href="mailto:secretariat@himmelsweg.fr">secretariat@himmelsweg.fr</a>.</p>
      </section>
    );
  }

  const tarifs = config.tarifs ?? [];
  const total = totalPanier(f.personnes, tarifs, config.don ? f.don : 0);
  const majPersonne = (i, p) => setF({ ...f, personnes: f.personnes.map((x, j) => (j === i ? p : x)) });
  const majPayeur = (k) => (e) => setF({ ...f, payeur: { ...f.payeur, [k]: e.currentTarget.value } });

  const verifier = () => {
    const parPersonne = f.personnes.map((p) => erreursPersonne(triees, p, tarifs));
    const generales = {};
    const pa = f.payeur;
    if (!pa.prenom.trim()) generales.payeurPrenom = 'Réponse obligatoire.';
    if (!pa.nom.trim()) generales.payeurNom = 'Réponse obligatoire.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pa.email.trim())) generales.payeurEmail = 'Adresse e-mail incorrecte.';
    if (!f.reglement) generales.reglement = 'À cocher pour continuer.';
    const ok = parPersonne.every((e) => !Object.keys(e).length) && !Object.keys(generales).length;
    return { ok, parPersonne, generales };
  };

  const envoyer = async (e) => {
    e.preventDefault();
    const v = verifier();
    setErreurs(v);
    if (!v.ok) {
      setMessage('Il manque quelques réponses : elles sont signalées en rouge.');
      requestAnimationFrame(() => document.querySelector('.en-erreur')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setEnvoi(true);
    setMessage('');
    try {
      const piege = e.currentTarget.elements.site?.value ?? '';
      const r = await donnees.inscrire({
        personnes: f.personnes.map(({ groupe, tarif, reponses }) => ({ groupe, tarif, reponses })),
        payeur: { ...f.payeur, email: f.payeur.email.trim() },
        don: config.don ? f.don : 0,
        reglement: f.reglement,
        piege,
        invite: invitation?.id,
      });
      try {
        localStorage.removeItem(BROUILLON);
        localStorage.removeItem(CLE_INVITE);
      } catch {}
      if (r.redirectUrl) location.href = r.redirectUrl;
      else location.href = lienInscription('/merci', { ref: r.ref });
    } catch (err) {
      setMessage(err.message);
      setEnvoi(false);
    }
  };

  const premiere = f.personnes[0]?.reponses ?? {};
  // Après un premier essai, les erreurs se mettent à jour au fil des corrections.
  const vivant = erreurs ? verifier() : null;
  const g = vivant?.generales ?? {};
  const DONS = [0, 1000, 2000, 5000];

  return (
    <form class="formulaire inscription" onSubmit={envoyer} noValidate>
      {accueil && <AccueilInvite de={invitation?.de} fermer={fermerAccueil} />}
      <h1>Inscription au pèlerinage</h1>
      {invitation?.de && (
        <p class="encart invite">
          <span>🙏 Vous êtes invité par {invitation.de}. Bienvenue sur le chemin du Ciel !</span>
        </p>
      )}
      <p>
        Vendredi 7, samedi 8 et dimanche 9 mai 2027, de Scherwiller à Colmar. Vous pouvez inscrire plusieurs personnes à la
        fois (par exemple toute une famille) et payer en une seule fois sur HelloAsso.
      </p>
      <p class="discret">Les questions marquées d’une étoile * sont obligatoires.</p>

      {f.personnes.map((p, i) => (
        <CartePersonne
          key={p.cle}
          numero={i + 1}
          personne={p}
          questions={triees}
          tarifs={tarifs}
          erreurs={vivant?.parPersonne?.[i]}
          changer={(np) => majPersonne(i, np)}
          retirer={f.personnes.length > 1 ? () => setF({ ...f, personnes: f.personnes.filter((_, j) => j !== i) }) : null}
        />
      ))}
      {f.personnes.length < 10 && (
        <button type="button" class="bouton secondaire" onClick={() => setF({ ...f, personnes: [...f.personnes, personneVide()] })}>
          + Inscrire une autre personne
        </button>
      )}

      <section class="carte">
        <h2>Personne qui paie</h2>
        <p class="discret">Elle reçoit la confirmation et, si besoin, les rappels de paiement.</p>
        {(premiere.prenom || premiere.nom) && !f.payeur.prenom && (
          <button
            type="button"
            class="lien-bouton"
            onClick={() => setF({ ...f, payeur: { ...f.payeur, prenom: premiere.prenom ?? '', nom: premiere.nom ?? '', email: premiere.email || f.payeur.email, tel: premiere.tel ?? '' } })}
          >
            C’est {premiere.prenom} {premiere.nom}
          </button>
        )}
        <div class="deux">
          <label class={`champ${g.payeurPrenom ? ' en-erreur' : ''}`}>
            <span class="libelle">Prénom *</span>
            <input value={f.payeur.prenom} autocomplete="given-name" onInput={majPayeur('prenom')} />
            {g.payeurPrenom && <small class="erreur">{g.payeurPrenom}</small>}
          </label>
          <label class={`champ${g.payeurNom ? ' en-erreur' : ''}`}>
            <span class="libelle">Nom *</span>
            <input value={f.payeur.nom} autocomplete="family-name" onInput={majPayeur('nom')} />
            {g.payeurNom && <small class="erreur">{g.payeurNom}</small>}
          </label>
        </div>
        <label class={`champ${g.payeurEmail ? ' en-erreur' : ''}`}>
          <span class="libelle">E-mail *</span>
          <input type="email" value={f.payeur.email} autocomplete="email" onInput={majPayeur('email')} />
          {g.payeurEmail && <small class="erreur">{g.payeurEmail}</small>}
        </label>
        {/* Case invisible : seuls les robots la remplissent. */}
        <input class="piege" name="site" tabIndex={-1} autocomplete="off" aria-hidden="true" />
      </section>

      {config.don && (
        <section class="carte">
          <h2>Un don pour le pèlerinage ? (facultatif)</h2>
          <p class="discret">Il aide à financer le pèlerinage et les places des pèlerins qui ont peu de moyens.</p>
          <div class="pilules">
            {DONS.map((d) => (
              <label key={d} class={!donLibre && f.don === d ? 'choisi' : ''}>
                <input
                  type="radio"
                  name="don"
                  checked={!donLibre && f.don === d}
                  onChange={() => {
                    setDonLibre(false);
                    setF({ ...f, don: d });
                  }}
                />
                {d ? euros(d) : 'Non merci'}
              </label>
            ))}
            <label class={donLibre ? 'choisi' : ''}>
              <input type="radio" name="don" checked={donLibre} onChange={() => setDonLibre(true)} />
              Autre montant
            </label>
          </div>
          {donLibre && (
            <label class="champ">
              <span class="libelle">Montant du don en euros</span>
              <input type="number" min="0" step="1" value={f.don ? f.don / 100 : ''} onInput={(e) => setF({ ...f, don: Math.max(0, Math.round(Number(e.currentTarget.value) * 100) || 0) })} />
            </label>
          )}
        </section>
      )}

      <section class="carte">
        <h2>Règlement du pèlerinage</h2>
        <div class="document">
          <Texte texte={config.reglement || ''} />
        </div>
        <div class={`champ${g.reglement ? ' en-erreur' : ''}`} data-champ="reglement">
          <label class="case">
            <input type="checkbox" checked={f.reglement} onChange={(e) => setF({ ...f, reglement: e.currentTarget.checked })} />
            <span>J’ai lu le règlement et je l’accepte pour chaque personne inscrite.</span>
          </label>
          {g.reglement && <small class="erreur">{g.reglement}</small>}
        </div>
      </section>

      <section class="carte recap">
        <h2>Récapitulatif</h2>
        <ul>
          {f.personnes.map((p) => {
            const t = tarifs.find((x) => x.id === p.tarif);
            return (
              <li key={p.cle}>
                <span>
                  {`${p.reponses.prenom ?? ''} ${p.reponses.nom ?? ''}`.trim() || 'Personne sans nom'}
                  {t && <small> · {t.nom}</small>}
                </span>
                <strong>{t ? euros(t.montant) : '—'}</strong>
              </li>
            );
          })}
          {config.don && f.don > 0 && (
            <li>
              <span>Don</span>
              <strong>{euros(f.don)}</strong>
            </li>
          )}
          <li class="total">
            <span>Total</span>
            <strong>{euros(total)}</strong>
          </li>
        </ul>
        {message && !(vivant?.ok && !envoi && message.startsWith('Il manque')) && (
          <p class="alerte" role="alert">
            {message}
          </p>
        )}
        <button class="bouton large" disabled={envoi}>
          {envoi ? 'Un instant…' : total > 0 ? `Payer ${euros(total)} sur HelloAsso` : 'Valider l’inscription'}
        </button>
        <p class="discret">
          {total > 0
            ? 'Paiement sécurisé par HelloAsso, la plateforme de paiement des associations. HelloAsso vous proposera de lui laisser une contribution : elle est facultative et va à HelloAsso, pas au pèlerinage.'
            : 'Aucun paiement à faire.'}
        </p>
      </section>
    </form>
  );
}

function CartePersonne({ numero, personne: p, questions, tarifs, erreurs = {}, changer, retirer }) {
  const age = ageDe(p.reponses);
  const proposes = tarifsPour(tarifs, age);
  const nom = `${p.reponses.prenom ?? ''} ${p.reponses.nom ?? ''}`.trim();
  const repondre = (id, v) => {
    const reponses = { ...p.reponses, [id]: v };
    // Si l'âge change, on retire un tarif qui ne convient plus.
    const tarif = id === 'dateNaissance' && p.tarif && !tarifsPour(tarifs, ageDe(reponses)).some((t) => t.id === p.tarif) ? '' : p.tarif;
    changer({ ...p, reponses, tarif });
  };

  return (
    <section class="carte personne">
      <div class="personne-titre">
        <h2>{nom || `Personne ${numero}`}</h2>
        {retirer && (
          <button type="button" class="lien-bouton danger" onClick={() => confirm('Retirer cette personne de l’inscription ?') && retirer()}>
            Retirer
          </button>
        )}
      </div>
      <fieldset class={`champ${erreurs.groupe ? ' en-erreur' : ''}`} data-champ="groupe">
        <legend class="libelle">
          Pèlerinage des hommes ou des femmes ?<span class="etoile"> *</span>
        </legend>
        <div class="pilules grandes">
          {[
            ['H', 'Homme'],
            ['F', 'Femme'],
          ].map(([v, t]) => (
            <label key={v} class={p.groupe === v ? 'choisi' : ''}>
              <input type="radio" name={`groupe-${p.cle}`} checked={p.groupe === v} onChange={() => changer({ ...p, groupe: v })} />
              {t}
            </label>
          ))}
        </div>
        {erreurs.groupe && <small class="erreur">{erreurs.groupe}</small>}
      </fieldset>

      {p.groupe &&
        questions
          .filter((q) => estVisible(q, p.groupe, p.reponses))
          .map((q) => (
            <ChampQuestion
              key={q.id}
              q={q}
              valeur={p.reponses[q.id]}
              erreur={erreurs[q.id]}
              changer={(v) => repondre(q.id, v)}
              nomSignataire=""
            />
          ))}

      {p.groupe && (
        <fieldset class={`champ${erreurs.tarif ? ' en-erreur' : ''}`} data-champ="tarif">
          <legend class="libelle">
            Tarif<span class="etoile"> *</span>
          </legend>
          {age === null && <small class="aide">Indiquez la date de naissance pour voir les tarifs possibles.</small>}
          <div class="tarifs">
            {proposes.map((t) => (
              <label key={t.id} class={p.tarif === t.id ? 'choisi' : ''}>
                <input type="radio" name={`tarif-${p.cle}`} checked={p.tarif === t.id} onChange={() => changer({ ...p, tarif: t.id })} />
                <span>{t.nom}</span>
                <strong>{t.montant ? euros(t.montant) : 'Gratuit'}</strong>
              </label>
            ))}
          </div>
          {erreurs.tarif && <small class="erreur">{erreurs.tarif}</small>}
        </fieldset>
      )}
    </section>
  );
}

function useEtat(donnees, ref, action = 'etatInscription') {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');
  const charger = () => {
    setErreur('');
    donnees[action](ref)
      .then(setEtat)
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [ref]);
  return { etat, erreur, recharger: charger };
}

function Merci({ donnees, ref_ }) {
  const { etat, erreur, recharger } = useEtat(donnees, ref_);
  const [essais, setEssais] = useState(0);
  // HelloAsso peut mettre quelques secondes à confirmer : on revérifie un peu.
  useEffect(() => {
    if (etat?.statut !== 'en_attente' || essais >= 4) return;
    const t = setTimeout(() => {
      setEssais(essais + 1);
      recharger();
    }, 4000);
    return () => clearTimeout(t);
  }, [etat, essais]);

  if (erreur) return <p class="alerte">{erreur}</p>;
  if (!etat) return <p class="discret">Vérification du paiement…</p>;
  if (etat.statut === 'en_attente') {
    return (
      <section class="carte">
        <h1>Paiement en cours de vérification</h1>
        <p>
          Nous n’avons pas encore la confirmation de HelloAsso. Si vous avez bien payé, elle arrive en général en quelques
          minutes, et chacun recevra alors son e-mail.
        </p>
        <div class="actions">
          <button type="button" class="bouton secondaire" onClick={recharger}>
            Vérifier à nouveau
          </button>
          <a class="lien-bouton" href={lienInscription('/payer', { ref: ref_ })}>
            Je n’ai pas payé
          </a>
        </div>
      </section>
    );
  }
  return <Confirmation etat={etat} donnees={donnees} />;
}

/** Prénoms pour « Bienvenue Paul et Françoise ! » (les noms sont « Prénom Nom »). */
export function prenomsBienvenue(noms = []) {
  const p = [...new Set(noms.map((n) => String(n).trim().split(/\s+/)[0]).filter(Boolean))];
  return p.length <= 1 ? p[0] ?? '' : `${p.slice(0, -1).join(', ')} et ${p.at(-1)}`;
}

/** Nombre qui monte jusqu'à « fin » en environ 1,5 s, après « delai » secondes. */
function useCompteur(fin, delai) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!fin) return;
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(fin);
    let image;
    const t = setTimeout(() => {
      const debut = performance.now();
      const pas = () => {
        const k = Math.min(1, (performance.now() - debut) / 1500);
        setN(Math.round(fin * (1 - Math.pow(1 - k, 3))));
        if (k < 1) image = requestAnimationFrame(pas);
      };
      image = requestAnimationFrame(pas);
    }, delai * 1000);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(image);
    };
  }, [fin]);
  return n;
}

/** Page de bienvenue animée, juste après le paiement. */
function Bienvenue({ etat }) {
  const prenoms = prenomsBienvenue(etat.noms);
  const titre = prenoms ? `Bienvenue ${prenoms} !` : 'Bienvenue !';
  const mots = titre.split(' ');
  const debuts = mots.map((_, m) => mots.slice(0, m).join(' ').length + (m ? 1 : 0));
  const inscrits = Number(etat.inscrits) || 0;
  const compte = useCompteur(inscrits, 6);
  const jours = joursAvant();
  const plusieurs = (etat.noms?.length ?? 0) > 1;
  const partager = async () => {
    const texte = `${plusieurs ? 'Nous venons' : 'Je viens'} de ${plusieurs ? 'nous' : 'm’'}inscrire au pèlerinage Himmelsweg, les 7, 8 et 9 mai 2027, sur le chemin du Ciel. Venez marcher avec ${plusieurs ? 'nous' : 'moi'} !`;
    const url = 'https://himmelsweg.fr/';
    try {
      if (navigator.share) await navigator.share({ text: texte, url });
      else open(`https://wa.me/?text=${encodeURIComponent(`${texte} ${url}`)}`, '_blank', 'noopener');
    } catch {
      // partage annulé
    }
  };
  return (
    <section class="bienvenue">
      <h1 class="ai-titre" aria-label={titre}>
        {mots.map((mot, m) => (
          <span key={m} class="ai-mot" aria-hidden="true">
            {[...mot].map((l, k) => (
              <span key={k} style={{ animationDelay: `${0.2 + (debuts[m] + k) * 0.045}s` }}>
                {l}
              </span>
            ))}
          </span>
        ))}
      </h1>
      <p class="ai-sous">sur le chemin du Ciel</p>
      <CarteAnimee decalage={-0.4} />
      {inscrits > 0 && (
        <p class="bv-compte">
          <span>Avec vous, nous sommes</span>
          <strong>{compte}</strong>
          <span>pèlerins inscrits</span>
        </p>
      )}
      {jours > 0 && <p class="bv-jours">Départ dans {jours} jour{jours > 1 ? 's' : ''}</p>}
      <button type="button" class="bouton bv-partager" onClick={partager}>
        Partager la nouvelle
      </button>
    </section>
  );
}

function Confirmation({ etat, donnees }) {
  const config = useAbonnement((cb) => donnees.ecouterConfig(cb), [donnees], null);
  return (
    <>
      <Bienvenue etat={etat} />
      <section class="carte">
        <h2>Votre inscription est confirmée</h2>
        <p>
          L’inscription de <strong>{etat.noms.join(', ')}</strong> est confirmée.
        </p>
        <p>
          Chaque personne va recevoir par e-mail son lien personnel vers l’application du pèlerinage (liste d’affaires,
          horaires, transport…). Pensez à regarder dans les indésirables.
        </p>
        {etat.liensDemo?.length > 0 && (
          <div class="encart">
            <strong>Démo :</strong> en vrai, ces liens partent par e-mail. Ici, vous pouvez les ouvrir directement :
            <ul>
              {etat.liensDemo.map((l) => (
                <li key={l.url}>
                  <a href={l.url}>{l.nom}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {config?.boutique && (
        <section class="carte">
          <h2>Options et souvenirs</h2>
          <p>Les options payantes (et quelques souvenirs du pèlerinage) sont dans la boutique.</p>
          <a class="bouton secondaire" href={config.boutique} target="_blank" rel="noopener">
            Voir la boutique
          </a>
        </section>
      )}
    </>
  );
}

function Payer({ donnees, ref_ }) {
  const { etat, erreur } = useEtat(donnees, ref_);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');
  const echec = new URLSearchParams(location.search).has('erreur');

  if (erreur) return <p class="alerte">{erreur}</p>;
  if (!etat) return <p class="discret">Chargement…</p>;
  if (etat.statut !== 'en_attente') return <Confirmation etat={etat} donnees={donnees} />;

  const payer = async () => {
    setEnvoi(true);
    try {
      const r = await donnees.payerInscription(ref_);
      if (r.redirectUrl) location.href = r.redirectUrl;
      else location.href = lienInscription('/merci', { ref: ref_ });
    } catch (e) {
      setMsg(e.message);
      setEnvoi(false);
    }
  };

  return (
    <section class="carte">
      <h1>Inscription en attente de paiement</h1>
      {echec && <p class="alerte">Le paiement n’a pas abouti. Vous pouvez réessayer.</p>}
      <p>
        L’inscription de <strong>{etat.noms.join(', ')}</strong> est enregistrée. Elle sera confirmée dès le paiement de{' '}
        <strong>{euros(etat.montant)}</strong>.
      </p>
      {msg && <p class="alerte">{msg}</p>}
      <button type="button" class="bouton large" disabled={envoi} onClick={payer}>
        {envoi ? 'Un instant…' : `Payer ${euros(etat.montant)} sur HelloAsso`}
      </button>
      <p class="discret">
        Vous préférez payer par chèque ou en espèces ? Écrivez à <a href="mailto:secretariat@himmelsweg.fr">secretariat@himmelsweg.fr</a> : le
        secrétariat validera votre inscription à réception.
      </p>
    </section>
  );
}

/** En démo seulement : remplace la page de paiement HelloAsso. */
function PaiementDemo({ donnees, ref_ }) {
  const { etat } = useEtat(donnees, ref_);
  if (!etat) return <p class="discret">Chargement…</p>;
  return (
    <section class="carte paiement-demo">
      <p class="etiquette">Simulation</p>
      <h1>Ici, la page de paiement HelloAsso</h1>
      <p>
        En vrai, la personne paie <strong>{euros(etat.montant)}</strong> par carte sur le site de HelloAsso, puis revient
        automatiquement sur l’app.
      </p>
      <div class="actions">
        <button
          type="button"
          class="bouton"
          onClick={async () => {
            await donnees.simulerPaiement(ref_);
            location.href = lienInscription('/merci', { ref: ref_ });
          }}
        >
          Payer (simulation)
        </button>
        <a class="bouton secondaire" href={lienInscription('/payer', { ref: ref_ })}>
          Abandonner le paiement
        </a>
      </div>
    </section>
  );
}
