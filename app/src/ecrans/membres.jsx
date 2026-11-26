import { useMemo, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { GROUPES, ROLES, age, droits, estMineur, nomRole } from '../donnees/modele.js';

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
        return m.roles?.includes(filtre);
      })
      .filter((m) => !q || `${nomComplet(m)} ${m.email ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'));
  }, [membres, cherche, groupe, filtre]);

  if (ajout) return <AjoutMembre donnees={donnees} chapitres={chapitres} fermer={() => setAjout(false)} />;
  if (membres === null) return <p class="discret">Chargement…</p>;

  const compte = (g) => membres.filter((m) => m.groupe === g).length;
  const volontaires = membres.filter((m) => m.volontaireChef && !m.roles?.includes('chef')).length;

  return (
    <>
      <h1>{d.admin ? 'Pèlerins' : 'Mon équipe'}</h1>
      {!d.voirTousLesMembres && session.chapitre && <p class="discret">Chapitre {nomChapitre(session.chapitre)}</p>}
      {d.voirTousLesMembres && (
      <div class="chiffres">
        <div>
          <strong>{membres.length}</strong>
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
      </section>

      <section class="carte sensible">
        <h2>Santé et contacts d’urgence</h2>
        {prive === null ? (
          <p class="discret">Chargement…</p>
        ) : prive.refuse ? (
          <p class="discret">Accès réservé aux admins, à la logistique et à l’adjoint sécurité du chapitre.</p>
        ) : (
          <dl class="fiche">
            <dt>Contact d’urgence</dt>
            <dd>
              {prive.urgenceNom || '—'}{' '}
              {prive.urgenceTel && <a href={`tel:${prive.urgenceTel.replace(/\s/g, '')}`}>{prive.urgenceTel}</a>}
            </dd>
            <dt>Santé</dt>
            <dd>{prive.sante || 'Rien de signalé'}</dd>
            <dt>Régime alimentaire</dt>
            <dd>{prive.regime || 'Aucun'}</dd>
            {estMineur(m) && (
              <>
                <dt>Référent (mineur)</dt>
                <dd>
                  {prive.referentNom || '—'}{' '}
                  {prive.referentTel && <a href={`tel:${prive.referentTel.replace(/\s/g, '')}`}>{prive.referentTel}</a>}
                </dd>
              </>
            )}
            <dt>Consentement santé</dt>
            <dd>{prive.consentementSante ? 'Donné' : 'Non donné'}</dd>
          </dl>
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
    </>
  );
}

function AjoutMembre({ donnees, chapitres, fermer }) {
  const [m, setM] = useState({ prenom: '', nom: '', groupe: 'F', email: '', tel: '', dateNaissance: '', chapitre: '' });
  const [p, setP] = useState({ urgenceNom: '', urgenceTel: '', sante: '', regime: '', referentNom: '', referentTel: '', consentementSante: false });
  const [erreur, setErreur] = useState('');
  const cm = (k) => (e) => setM({ ...m, [k]: e.currentTarget.value });
  const cp = (k) => (e) => setP({ ...p, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });

  const envoyer = async (e) => {
    e.preventDefault();
    try {
      const id = await donnees.ajouterMembre({ ...m, chapitre: m.chapitre || null, volontaireChef: false }, p);
      location.hash = `#/pelerins/${id}`;
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <form class="formulaire" onSubmit={envoyer}>
      <h1>Ajouter un pèlerin</h1>
      <p class="discret">Normalement, les inscrits arrivent tout seuls depuis HelloAsso. Ce formulaire sert aux cas particuliers.</p>
      {erreur && <p class="alerte">{erreur}</p>}
      <div class="deux">
        <label>
          Prénom
          <input required value={m.prenom} onInput={cm('prenom')} />
        </label>
        <label>
          Nom
          <input required value={m.nom} onInput={cm('nom')} />
        </label>
      </div>
      <label>
        Groupe
        <select value={m.groupe} onChange={(e) => setM({ ...m, groupe: e.currentTarget.value, chapitre: '' })}>
          <option value="F">Femmes</option>
          <option value="H">Hommes</option>
        </select>
      </label>
      <label>
        Chapitre
        <select value={m.chapitre} onChange={cm('chapitre')}>
          <option value="">Plus tard</option>
          {chapitres
            .filter((c) => c.groupe === m.groupe)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
        </select>
      </label>
      <div class="deux">
        <label>
          E-mail
          <input type="email" value={m.email} onInput={cm('email')} />
        </label>
        <label>
          Téléphone
          <input type="tel" value={m.tel} onInput={cm('tel')} />
        </label>
      </div>
      <label>
        Date de naissance
        <input type="date" value={m.dateNaissance} onInput={cm('dateNaissance')} />
      </label>
      <fieldset>
        <legend>Informations protégées</legend>
        <div class="deux">
          <label>
            Contact d’urgence
            <input value={p.urgenceNom} onInput={cp('urgenceNom')} />
          </label>
          <label>
            Son téléphone
            <input type="tel" value={p.urgenceTel} onInput={cp('urgenceTel')} />
          </label>
        </div>
        <label>
          Santé (à signaler)
          <input value={p.sante} onInput={cp('sante')} />
        </label>
        <label>
          Régime alimentaire
          <input value={p.regime} onInput={cp('regime')} />
        </label>
        {estMineur(m) && (
          <div class="deux">
            <label>
              Référent du mineur
              <input required value={p.referentNom} onInput={cp('referentNom')} />
            </label>
            <label>
              Son téléphone
              <input type="tel" required value={p.referentTel} onInput={cp('referentTel')} />
            </label>
          </div>
        )}
        <label class="case">
          <input type="checkbox" checked={p.consentementSante} onChange={cp('consentementSante')} />
          La personne accepte que ses informations de santé soient connues des responsables sécurité.
        </label>
      </fieldset>
      <div class="actions">
        <button class="bouton">Ajouter</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
