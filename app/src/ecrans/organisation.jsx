// Écran admin « Organisation » : chapitres (hommes et femmes séparés), équipes logistique et repas.
import { useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { GROUPES, ROLES_DE_CHAPITRE, sansRolesDeChapitre } from '../donnees/modele.js';

const nomComplet = (m) => `${m.prenom ?? ''} ${m.nom ?? ''}`.trim();
const initiales = (m) => `${m.prenom?.[0] ?? ''}${m.nom?.[0] ?? ''}`.toUpperCase();
const parNom = (a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr');
const aRole = (m, r) => (m.roles ?? []).includes(r);
const avecRole = (m, r) => [...new Set([...(m.roles ?? []), r])];
const sansRole = (m, r) => (m.roles ?? []).filter((x) => x !== r);
const EQUIPES = [
  { id: 'logistique', nom: 'Équipe logistique', aide: 'Parcours, liste prévoyance, alertes. Voit les fiches de tous les pèlerins.' },
  { id: 'repas', nom: 'Équipe repas', aide: 'Menus, quantités, fournisseurs. Ne voit que le nombre de personnes par régime.' },
];

function Pastille({ m }) {
  return (
    <span class={`pastille groupe-${m.groupe}`} title={GROUPES[m.groupe]}>
      {m.groupe ?? '?'}
    </span>
  );
}

/** Liste déroulante pour ajouter quelqu'un, groupée Hommes / Femmes. */
function ChoixPersonne({ personnes, choisir, invite = 'Ajouter quelqu’un…', vide = 'Personne à ajouter', groupes = ['H', 'F'] }) {
  const options = (liste) =>
    liste.sort(parNom).map((m) => (
      <option key={m.id} value={m.id}>
        {nomComplet(m)}
        {m.volontaireChef ? ' ★ volontaire chef' : ''}
        {m.statut === 'en_attente' ? ' (paiement en attente)' : ''}
      </option>
    ));
  return (
    <select class="choix-personne" value="" onChange={(e) => e.currentTarget.value && choisir(e.currentTarget.value)} disabled={!personnes.length}>
      <option value="">{personnes.length ? invite : vide}</option>
      {groupes.length > 1
        ? groupes.map((g) => (
            <optgroup key={g} label={GROUPES[g]}>
              {options(personnes.filter((m) => m.groupe === g))}
            </optgroup>
          ))
        : options([...personnes])}
    </select>
  );
}

export function AdminOrganisation({ donnees, chapitreId }) {
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], null);
  const membres = useAbonnement((cb) => donnees.ecouterMembres(cb), [donnees], null);
  const [msg, setMsg] = useState('');

  if (chapitres === null || membres === null) return <p class="discret">Chargement…</p>;
  const agir = async (action, texte) => {
    try {
      await action();
      setMsg(texte);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const actifs = membres.filter((m) => m.statut !== 'annule');

  if (chapitreId) {
    const c = chapitres.find((x) => x.id === chapitreId);
    if (!c) return <p class="discret">Chapitre introuvable.</p>;
    return <DetailChapitre {...{ donnees, c, membres: actifs, msg, setMsg, agir }} />;
  }

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Organisation</h1>
      <p class="discret">
        Créez les chapitres, puis ouvrez-en un pour y mettre des pèlerins et choisir le chef. Le chef nomme ensuite lui-même
        son adjoint sécurité.
      </p>
      {msg && (
        <p class="info" role="status">
          {msg}
        </p>
      )}
      {['H', 'F'].map((g) => (
        <BlocGroupe key={g} {...{ donnees, g, chapitres, membres: actifs, agir }} />
      ))}
      {EQUIPES.map((e) => (
        <BlocEquipe key={e.id} equipe={e} {...{ donnees, membres: actifs, agir }} />
      ))}
    </>
  );
}

function BlocGroupe({ donnees, g, chapitres, membres, agir }) {
  const [nom, setNom] = useState('');
  const duGroupe = membres.filter((m) => m.groupe === g);
  const sansChapitre = duGroupe.filter((m) => !m.chapitre || !chapitres.some((c) => c.id === m.chapitre));
  const volontaires = sansChapitre.filter((m) => m.volontaireChef && !aRole(m, 'chef'));
  const liste = chapitres.filter((c) => c.groupe === g).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const creer = (e) => {
    e.preventDefault();
    const n = nom.trim();
    if (!n) return;
    agir(() => donnees.enregistrerChapitre({ nom: n, groupe: g }), `Chapitre « ${n} » créé (${GROUPES[g].toLowerCase()}).`);
    setNom('');
  };
  return (
    <section class={`carte bloc-groupe bloc-${g}`}>
      <h2>
        <span class={`pastille groupe-${g}`}>{g}</span> Chapitres {g === 'H' ? 'des hommes' : 'des femmes'}
      </h2>
      <p class="discret">
        {duGroupe.length} {g === 'H' ? 'homme' : 'femme'}
        {duGroupe.length > 1 ? 's' : ''} inscrit{g === 'F' ? 'e' : ''}
        {duGroupe.length > 1 ? 's' : ''} · {sansChapitre.length} sans chapitre
        {volontaires.length ? ` · ${volontaires.length} volontaire${volontaires.length > 1 ? 's' : ''} pour être chef` : ''}
      </p>
      {liste.length ? (
        <ul class="elements">
          {liste.map((c) => {
            const dedans = membres.filter((m) => m.chapitre === c.id);
            const chef = dedans.find((m) => aRole(m, 'chef'));
            const adjoint = dedans.find((m) => aRole(m, 'securite'));
            return (
              <li key={c.id}>
                <a class="lien-ligne" href={`#/admin/organisation/${c.id}`}>
                  <span>
                    <strong>{c.nom}</strong>
                    <small>
                      {dedans.length} pèlerin{dedans.length > 1 ? 's' : ''} · {chef ? `chef : ${nomComplet(chef)}` : 'pas encore de chef'}
                      {adjoint ? ` · adjoint : ${nomComplet(adjoint)}` : ''}
                    </small>
                  </span>
                  <span aria-hidden="true">›</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="discret">Aucun chapitre pour l’instant.</p>
      )}
      <form class="ajout-ligne" onSubmit={creer}>
        <input
          value={nom}
          onInput={(e) => setNom(e.currentTarget.value)}
          placeholder={g === 'H' ? 'Ex. : Saint-Joseph' : 'Ex. : Sainte-Odile'}
          aria-label={`Nom du nouveau chapitre ${GROUPES[g].toLowerCase()}`}
        />
        <button type="submit" class="bouton petit" disabled={!nom.trim()}>
          + Créer
        </button>
      </form>
    </section>
  );
}

function BlocEquipe({ donnees, equipe, membres, agir }) {
  const dedans = membres.filter((m) => aRole(m, equipe.id)).sort(parNom);
  const dehors = membres.filter((m) => !aRole(m, equipe.id));
  return (
    <section class="carte">
      <h2>{equipe.nom}</h2>
      <p class="discret">{equipe.aide}</p>
      {dedans.length ? (
        <ul class="elements">
          {dedans.map((m) => (
            <li key={m.id}>
              <span class="orga-personne">
                <Pastille m={m} />
                <a href={`#/pelerins/${m.id}`}>{nomComplet(m)}</a>
              </span>
              <button
                type="button"
                class="lien-bouton danger"
                onClick={() => agir(() => donnees.modifierMembre(m.id, { roles: sansRole(m, equipe.id) }), `${nomComplet(m)} ne fait plus partie de l’${equipe.nom.toLowerCase()}.`)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="discret">Personne pour l’instant.</p>
      )}
      <ChoixPersonne
        personnes={dehors}
        choisir={(id) => {
          const m = membres.find((x) => x.id === id);
          agir(() => donnees.modifierMembre(id, { roles: avecRole(m, equipe.id) }), `${nomComplet(m)} ajouté${m.groupe === 'F' ? 'e' : ''} à l’${equipe.nom.toLowerCase()}.`);
        }}
      />
    </section>
  );
}

function DetailChapitre({ donnees, c, membres, msg, setMsg, agir }) {
  const [nom, setNom] = useState(c.nom);
  const dedans = membres.filter((m) => m.chapitre === c.id).sort(parNom);
  const libres = membres.filter((m) => m.groupe === c.groupe && !m.chapitre);
  const chef = dedans.find((m) => aRole(m, 'chef'));
  const adjoint = dedans.find((m) => aRole(m, 'securite'));
  const genre = c.groupe === 'F' ? 'e' : '';

  const choisirChef = async (id) => {
    const nouveau = dedans.find((m) => m.id === id);
    await agir(async () => {
      for (const m of dedans.filter((x) => aRole(x, 'chef') && x.id !== id)) await donnees.modifierMembre(m.id, { roles: sansRole(m, 'chef') });
      if (nouveau) await donnees.modifierMembre(id, { roles: avecRole(sansRole(nouveau, 'securite'), 'chef') });
    }, nouveau ? `${nomComplet(nouveau)} est chef du chapitre.` : 'Le chapitre n’a plus de chef.');
  };
  const retirer = (m) =>
    agir(
      () => donnees.modifierMembre(m.id, { chapitre: null, roles: sansRolesDeChapitre(m.roles) }),
      `${nomComplet(m)} retiré${m.groupe === 'F' ? 'e' : ''} du chapitre.`,
    );
  const ajouter = (id) => {
    const m = membres.find((x) => x.id === id);
    agir(() => donnees.modifierMembre(id, { chapitre: c.id }), `${nomComplet(m)} ajouté${m.groupe === 'F' ? 'e' : ''} au chapitre.`);
  };
  const renommer = (e) => {
    e.preventDefault();
    if (nom.trim() && nom.trim() !== c.nom) agir(() => donnees.enregistrerChapitre({ ...c, nom: nom.trim() }), 'Nom enregistré.');
  };
  const supprimer = async () => {
    if (!confirm(`Supprimer le chapitre « ${c.nom} » ? Ses ${dedans.length} pèlerin(s) resteront inscrits, sans chapitre.`)) return;
    try {
      await donnees.supprimerChapitre(c.id);
      location.hash = '#/admin/organisation';
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <a class="retour" href="#/admin/organisation">
        ← Organisation
      </a>
      <h1>
        <span class={`pastille groupe-${c.groupe}`}>{c.groupe}</span> {c.nom}
      </h1>
      <p class={`bandeau-groupe bloc-${c.groupe}`}>Chapitre {c.groupe === 'H' ? 'des hommes' : 'des femmes'}</p>
      {msg && (
        <p class="info" role="status">
          {msg}
        </p>
      )}

      <section class="carte">
        <h2>Chef de chapitre</h2>
        {dedans.length ? (
          <select class="choix-personne" value={chef?.id ?? ''} onChange={(e) => choisirChef(e.currentTarget.value)}>
            <option value="">Pas encore de chef</option>
            {dedans.map((m) => (
              <option key={m.id} value={m.id}>
                {nomComplet(m)}
                {m.volontaireChef ? ' ★ volontaire' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p class="discret">Ajoutez d’abord des pèlerins au chapitre, puis choisissez le chef parmi eux.</p>
        )}
        <p class="discret">
          Adjoint sécurité : {adjoint ? nomComplet(adjoint) : 'pas encore nommé'}. C’est le chef qui le choisit dans l’app.
        </p>
      </section>

      <section class="carte">
        <h2>
          {dedans.length} pèlerin{dedans.length > 1 ? 's' : ''}
        </h2>
        {dedans.length > 0 && (
          <ul class="elements">
            {dedans.map((m) => (
              <li key={m.id}>
                <span class="orga-personne">
                  <span class={`pastille groupe-${m.groupe}`}>{initiales(m)}</span>
                  <span>
                    <a href={`#/pelerins/${m.id}`}>{nomComplet(m)}</a>
                    <small>
                      {ROLES_DE_CHAPITRE.filter((r) => aRole(m, r))
                        .map((r) => (r === 'chef' ? 'Chef de chapitre' : 'Adjoint sécurité'))
                        .join(', ')}
                      {m.statut === 'en_attente' ? ' Paiement en attente' : ''}
                    </small>
                  </span>
                </span>
                <button type="button" class="lien-bouton danger" onClick={() => retirer(m)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
        <ChoixPersonne
          personnes={libres}
          groupes={[c.groupe]}
          vide={`Tou${genre ? 'te' : ''}s les ${c.groupe === 'H' ? 'hommes' : 'femmes'} ont déjà un chapitre`}
          invite={`Ajouter un${genre === 'e' ? 'e pèlerine' : ' pèlerin'} sans chapitre…`}
          choisir={ajouter}
        />
        <p class="discret">Seul{genre}s les {c.groupe === 'H' ? 'hommes' : 'femmes'} sans chapitre sont proposé{genre}s. ★ = s’est proposé{genre} comme chef.</p>
      </section>

      <section class="carte">
        <h2>Nom du chapitre</h2>
        <form class="ajout-ligne" onSubmit={renommer}>
          <input value={nom} onInput={(e) => setNom(e.currentTarget.value)} aria-label="Nom du chapitre" />
          <button type="submit" class="bouton petit secondaire" disabled={!nom.trim() || nom.trim() === c.nom}>
            Renommer
          </button>
        </form>
        <button type="button" class="lien-bouton danger" onClick={supprimer}>
          Supprimer ce chapitre
        </button>
      </section>
    </>
  );
}
