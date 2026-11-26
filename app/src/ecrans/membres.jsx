import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { ChampQuestion } from '../composants/champs.jsx';
import { GROUPES, ROLES, age, droits, estMineur, nomRole } from '../donnees/modele.js';
import { CHAMPS_FICHE, enTexte, erreursPersonne, estVisible, questionsTriees, reponsesDe, versFiche } from '../donnees/questionnaire.js';

const enAttente = (m) => m.statut === 'en_attente';

const nomComplet = (m) => `${m.prenom ?? ''} ${m.nom ?? ''}`.trim();

export function ListeMembres({ donnees, session }) {
  const membres = useAbonnement((cb) => donnees.ecouterMembres(cb), [donnees, session.id], null);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const [cherche, setCherche] = useState('');
  const [groupe, setGroupe] = useState('');
  const [filtre, setFiltre] = useState('');
  const [ajout, setAjout] = useState(false);
  const d = droits(session);

  const nomChapitre = (id) => chapitres.find((c) => c.id === id)?.nom ?? '';
  const liste = useMemo(() => {
    const q = cherche.trim().toLowerCase();
    return (membres ?? [])
      .filter((m) => !groupe || m.groupe === groupe)
      .filter((m) => {
        if (!filtre) return true;
        if (filtre === 'volontaires') return m.volontaireChef && !m.roles?.includes('chef');
        if (filtre === 'mineurs') return estMineur(m);
        if (filtre === 'sans-chapitre') return !m.chapitre;
        if (filtre === 'en-attente') return enAttente(m);
        return m.roles?.includes(filtre);
      })
      .filter((m) => !q || `${nomComplet(m)} ${m.email ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'));
  }, [membres, cherche, groupe, filtre]);

  if (ajout) return <AjoutMembre donnees={donnees} chapitres={chapitres} fermer={() => setAjout(false)} />;
  if (membres === null) return <p class="discret">Chargement…</p>;

  const confirmes = membres.filter((m) => !enAttente(m));
  const compte = (g) => confirmes.filter((m) => m.groupe === g).length;
  const attente = membres.length - confirmes.length;
  const volontaires = membres.filter((m) => m.volontaireChef && !m.roles?.includes('chef')).length;

  return (
    <>
      <h1>{d.voirTousLesMembres ? 'Pèlerins' : 'Mon chapitre'}</h1>
      {!d.voirTousLesMembres && session.chapitre && <p class="discret">Chapitre {nomChapitre(session.chapitre)}</p>}
      {d.voirTousLesMembres && (
      <div class="chiffres">
        <div>
          <strong>{confirmes.length}</strong>
          <span>inscrits</span>
        </div>
        <div>
          <strong>{compte('H')}</strong>
          <span>hommes</span>
        </div>
        <div>
          <strong>{compte('F')}</strong>
          <span>femmes</span>
        </div>
      </div>
      )}
      {d.admin && attente > 0 && (
        <a class="encart" href="#/admin/inscriptions">
          {attente} inscription{attente > 1 ? 's' : ''} en attente de paiement
        </a>
      )}
      {d.admin && volontaires > 0 && (
        <button type="button" class="encart" onClick={() => setFiltre('volontaires')}>
          {volontaires} volontaire{volontaires > 1 ? 's' : ''} pour être chef de chapitre, à valider
        </button>
      )}
      <div class="filtres">
        <input type="search" placeholder="Rechercher un nom" value={cherche} onInput={(e) => setCherche(e.currentTarget.value)} />
        <select value={groupe} onChange={(e) => setGroupe(e.currentTarget.value)} aria-label="Hommes ou femmes">
          <option value="">Hommes et femmes</option>
          <option value="H">Hommes</option>
          <option value="F">Femmes</option>
        </select>
        <select value={filtre} onChange={(e) => setFiltre(e.currentTarget.value)} aria-label="Filtre">
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
            </option>
          ))}
          <option value="volontaires">Volontaires chef à valider</option>
          <option value="mineurs">Mineurs</option>
          {d.admin && <option value="sans-chapitre">Sans chapitre</option>}
          {d.admin && <option value="en-attente">Paiement en attente</option>}
        </select>
      </div>
      <ul class="liste-membres">
        {liste.map((m) => (
          <li key={m.id}>
            <a href={`#/pelerins/${m.id}`}>
              <span class={`pastille groupe-${m.groupe}`}>{m.groupe}</span>
              <span class="lm-nom">
                {nomComplet(m)}
                <small>
                  {[nomChapitre(m.chapitre), ...(m.roles ?? []).filter((r) => r !== 'pelerin').map(nomRole)]
                    .filter(Boolean)
                    .join(' · ')}
                  {estMineur(m) && ' · mineur'}
                </small>
              </span>
              {enAttente(m) && <span class="etiquette attente">paiement en attente</span>}
              {m.volontaireChef && !m.roles?.includes('chef') && <span class="etiquette">volontaire chef</span>}
            </a>
          </li>
        ))}
      </ul>
      {liste.length === 0 && <p class="discret">Personne ne correspond.</p>}
      {d.admin && (
        <button type="button" class="bouton secondaire" onClick={() => setAjout(true)}>
          Ajouter un pèlerin à la main
        </button>
      )}
    </>
  );
}

export function FicheMembre({ donnees, session, id }) {
  const membres = useAbonnement((cb) => donnees.ecouterMembres(cb), [donnees, session.id], null);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const prive = useAbonnement((cb) => donnees.ecouterPrive(id, cb), [donnees, id], null);
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], []);
  const [lien, setLien] = useState('');
  const [msg, setMsg] = useState('');
  const admin = droits(session).admin;
  const m = membres?.find((x) => x.id === id);

  if (membres === null) return <p class="discret">Chargement…</p>;
  if (!m) return <p class="discret">Fiche introuvable ou non accessible.</p>;

  const modifier = async (champs) => {
    try {
      await donnees.modifierMembre(id, champs);
      setMsg('Enregistré.');
    } catch (e) {
      setMsg(e.message);
    }
  };
  const basculerRole = (r) => {
    const roles = new Set(m.roles ?? []);
    roles.has(r) ? roles.delete(r) : roles.add(r);
    modifier({ roles: ROLES.map((x) => x.id).filter((x) => roles.has(x)) });
  };
  const chapitresDuGroupe = chapitres.filter((c) => c.groupe === m.groupe);
  // Le chef choisit l'adjoint sécurité parmi les pèlerins de son chapitre.
  const chefIci = !admin && session.roles?.includes('chef') && !!session.chapitre && m.chapitre === session.chapitre;
  const supprimer = async () => {
    if (!confirm(`Supprimer l’inscription de ${nomComplet(m)} ? Sa fiche, ses réponses et son lien seront effacés. Un éventuel remboursement se fait sur HelloAsso.`)) return;
    try {
      await donnees.supprimerMembre(id);
      location.hash = '#/pelerins';
    } catch (e) {
      setMsg(e.message);
    }
  };
  const reponses = reponsesDe(m, prive);
  const affichees = questionsTriees(questions).filter(
    (q) => q.type !== 'info' && !CHAMPS_FICHE.includes(q.id) && estVisible(q, m.groupe, reponses),
  );
  const valeur = (q) => {
    const v = reponses[q.id];
    if (q.type === 'telephone' && v) return <a href={`tel:${String(v).replace(/\s/g, '')}`}>{v}</a>;
    if (q.type === 'signature' && v?.image)
      return (
        <>
          {enTexte(q, v)}
          <img class="signature-image" src={v.image} alt="" />
        </>
      );
    return enTexte(q, v);
  };
  const lignes = (liste) =>
    liste.map((q) => (
      <Fragment key={q.id}>
        <dt>{q.libelle}</dt>
        <dd>{valeur(q)}</dd>
      </Fragment>
    ));
  const montrerLien = async (nouveau) => {
    if (nouveau && !confirm('L’ancien lien ne marchera plus. Continuer ?')) return;
    setLien(await donnees.lienPersonnel(id, { nouveau }));
  };

  return (
    <>
      <a class="retour" href="#/pelerins">
        ← Retour à la liste
      </a>
      <h1>{nomComplet(m)}</h1>
      {msg && <p class="info" role="status">{msg}</p>}

      <section class="carte">
        <h2>Coordonnées</h2>
        <dl class="fiche">
          <dt>Groupe</dt>
          <dd>{GROUPES[m.groupe] ?? '—'}</dd>
          <dt>Âge au pèlerinage</dt>
          <dd>{age(m.dateNaissance) ?? '—'} ans{estMineur(m) && ' (mineur)'}</dd>
          <dt>Téléphone</dt>
          <dd>{m.tel ? <a href={`tel:${m.tel.replace(/\s/g, '')}`}>{m.tel}</a> : '—'}</dd>
          <dt>E-mail</dt>
          <dd>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : '—'}</dd>
          <dt>Chapitre</dt>
          <dd>
            {admin ? (
              <select value={m.chapitre ?? ''} onChange={(e) => modifier({ chapitre: e.currentTarget.value || null })}>
                <option value="">Aucun</option>
                {chapitresDuGroupe.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            ) : (
              chapitres.find((c) => c.id === m.chapitre)?.nom ?? '—'
            )}
          </dd>
          {admin && (
            <>
              <dt>Inscription</dt>
              <dd>
                {enAttente(m) ? (
                  <a href="#/admin/inscriptions">Paiement en attente</a>
                ) : (
                  'Confirmée'
                )}
                {m.tarif && ` · tarif ${m.tarif}`}
                {m.inscritLe && ` · le ${new Date(m.inscritLe).toLocaleDateString('fr-FR')}`}
              </dd>
            </>
          )}
          {lignes(affichees.filter((q) => q.visibilite !== 'sensible'))}
        </dl>
      </section>

      <section class="carte">
        <h2>Rôles</h2>
        {m.volontaireChef && !m.roles?.includes('chef') && (
          <div class="encart">
            S’est proposé{m.groupe === 'F' ? 'e' : ''} comme chef de chapitre à l’inscription.
            {admin && (
              <button type="button" class="bouton petit" onClick={() => basculerRole('chef')}>
                Valider comme chef
              </button>
            )}
          </div>
        )}
        {admin ? (
          <div class="cases">
            {ROLES.map((r) => (
              <label key={r.id}>
                <input type="checkbox" checked={m.roles?.includes(r.id)} onChange={() => basculerRole(r.id)} />
                {r.nom}
              </label>
            ))}
          </div>
        ) : (
          <p>{(m.roles ?? []).map(nomRole).join(', ') || '—'}</p>
        )}
        {chefIci && m.id !== session.id && (
          <button
            type="button"
            class={`bouton petit${m.roles?.includes('securite') ? ' secondaire' : ''}`}
            onClick={() =>
              donnees
                .nommerAdjoint(id, !m.roles?.includes('securite'))
                .then(() => setMsg(m.roles?.includes('securite') ? 'Ce n’est plus l’adjoint sécurité.' : 'Nommé adjoint sécurité du chapitre.'))
                .catch((e) => setMsg(e.message))
            }
          >
            {m.roles?.includes('securite') ? 'Retirer le rôle d’adjoint sécurité' : 'Nommer adjoint sécurité'}
          </button>
        )}
      </section>

      <section class="carte sensible">
        <h2>🔒 Informations protégées</h2>
        {prive === null ? (
          <p class="discret">Chargement…</p>
        ) : prive.refuse ? (
          <p class="discret">Accès réservé aux admins, à la logistique et à l’adjoint sécurité du chapitre.</p>
        ) : (
          <dl class="fiche">{lignes(affichees.filter((q) => q.visibilite === 'sensible'))}</dl>
        )}
      </section>

      {admin && (
        <section class="carte">
          <h2>Lien personnel</h2>
          <p class="discret">Le lien ouvre l’app pour cette personne, sans mot de passe. Ne le donnez qu’à elle.</p>
          {lien && (
            <p class="lien-perso">
              <input readOnly value={lien} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" class="bouton petit" onClick={() => navigator.clipboard?.writeText(lien).then(() => setMsg('Lien copié.'))}>
                Copier
              </button>
            </p>
          )}
          <div class="actions">
            <button type="button" class="bouton secondaire" onClick={() => montrerLien(false)}>
              Afficher le lien
            </button>
            <button type="button" class="lien-bouton danger" onClick={() => montrerLien(true)}>
              Remplacer le lien (perdu ou partagé)
            </button>
          </div>
        </section>
      )}

      {admin && (
        <section class="carte">
          <h2>Désistement</h2>
          <button type="button" class="lien-bouton danger" onClick={supprimer}>
            Supprimer cette inscription
          </button>
        </section>
      )}
    </>
  );
}

function AjoutMembre({ donnees, chapitres, fermer }) {
  const questions = useAbonnement((cb) => donnees.ecouterQuestions(cb), [donnees], []);
  const [groupe, setGroupe] = useState('F');
  const [chapitre, setChapitre] = useState('');
  const [reponses, setReponses] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState('');
  const triees = questionsTriees(questions);

  const envoyer = async (e) => {
    e.preventDefault();
    // Un admin peut laisser des réponses vides ; seuls le nom et le prénom sont exigés.
    const err = erreursPersonne(triees, { groupe, reponses });
    const bloquant = Object.fromEntries(Object.entries(err).filter(([k, v]) => ['prenom', 'nom'].includes(k) || !v.includes('obligatoire') && !v.includes('cocher') && !v.includes('Signature')));
    setErreurs(bloquant);
    if (Object.keys(bloquant).length) return setErreur('Vérifiez les réponses signalées.');
    const { membre, prive } = versFiche(triees, groupe, reponses);
    try {
      const id = await donnees.ajouterMembre({ ...membre, chapitre: chapitre || null }, prive);
      location.hash = `#/pelerins/${id}`;
    } catch (er) {
      setErreur(er.message);
    }
  };

  return (
    <form class="formulaire" onSubmit={envoyer} noValidate>
      <h1>Ajouter un pèlerin</h1>
      <p class="discret">
        Normalement, chacun s’inscrit lui-même sur app.himmelsweg.fr/inscription. Ce formulaire sert aux cas particuliers (inscription
        papier, par téléphone…). Seuls le prénom et le nom sont exigés.
      </p>
      {erreur && <p class="alerte">{erreur}</p>}
      <div class="deux">
        <label>
          Groupe
          <select
            value={groupe}
            onChange={(e) => {
              setGroupe(e.currentTarget.value);
              setChapitre('');
            }}
          >
            <option value="F">Femmes</option>
            <option value="H">Hommes</option>
          </select>
        </label>
        <label>
          Chapitre
          <select value={chapitre} onChange={(e) => setChapitre(e.currentTarget.value)}>
            <option value="">Plus tard</option>
            {chapitres
              .filter((c) => c.groupe === groupe)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
          </select>
        </label>
      </div>
      {triees
        .filter((q) => estVisible(q, groupe, reponses) && q.type !== 'info')
        .map((q) => (
          <ChampQuestion key={q.id} q={q} valeur={reponses[q.id]} erreur={erreurs[q.id]} changer={(v) => setReponses({ ...reponses, [q.id]: v })} />
        ))}
      <div class="actions">
        <button class="bouton">Ajouter</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
