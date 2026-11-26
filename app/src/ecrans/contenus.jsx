import { useState } from 'preact/hooks';
import { Texte, useAbonnement } from '../composants/base.jsx';
import { PERIODES, droits } from '../donnees/modele.js';

export function Contenus({ donnees, session, periode }) {
  const tous = useAbonnement((cb) => donnees.ecouterContenus(cb), [donnees], null);
  const [edition, setEdition] = useState(null); // contenu en cours de modification
  const peutModifier = droits(session).modifierContenus;
  const p = PERIODES.find((x) => x.id === periode);
  const liste = (tous ?? []).filter((c) => c.periode === periode);

  if (edition) {
    return <EditeurContenu donnees={donnees} contenu={edition} fermer={() => setEdition(null)} />;
  }

  return (
    <>
      <h1>{p.titre}</h1>
      {periode === 'pendant' && (
        <a class="bouton urgence" href="tel:112">
          Appeler les secours (112)
        </a>
      )}
      {tous === null && <p class="discret">Chargement…</p>}
      {tous !== null && liste.length === 0 && <p class="discret">Rien pour l’instant.</p>}
      {liste.map((c) => (
        <article class="carte" key={c.id}>
          <div class="carte-titre">
            <h2>{c.titre}</h2>
            {peutModifier && (
              <button type="button" class="lien-bouton" onClick={() => setEdition(c)}>
                Modifier
              </button>
            )}
          </div>
          <Texte texte={c.texte} />
        </article>
      ))}
      {peutModifier && (
        <button
          type="button"
          class="bouton secondaire"
          onClick={() => setEdition({ periode, titre: '', texte: '', ordre: (liste.at(-1)?.ordre ?? 0) + 1 })}
        >
          Ajouter une rubrique
        </button>
      )}
    </>
  );
}

function EditeurContenu({ donnees, contenu, fermer }) {
  const [c, setC] = useState(contenu);
  const [erreur, setErreur] = useState('');
  const champ = (k) => (e) => setC({ ...c, [k]: e.currentTarget.value });

  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await donnees.enregistrerContenu({ ...c, ordre: Number(c.ordre) || 0 });
      fermer();
    } catch (err) {
      setErreur(err.message);
    }
  };
  const supprimer = async () => {
    if (!confirm(`Supprimer « ${c.titre} » ?`)) return;
    await donnees.supprimerContenu(c.id);
    fermer();
  };

  return (
    <form class="formulaire" onSubmit={enregistrer}>
      <h1>{c.id ? 'Modifier la rubrique' : 'Nouvelle rubrique'}</h1>
      {erreur && <p class="alerte">{erreur}</p>}
      <label>
        Titre
        <input required value={c.titre} onInput={champ('titre')} />
      </label>
      <label>
        Moment
        <select value={c.periode} onChange={champ('periode')}>
          {PERIODES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Texte
        <textarea rows="12" value={c.texte} onInput={champ('texte')} />
      </label>
      <p class="aide">
        Astuces : une ligne qui commence par « - » fait une liste. **mot** met en gras, *mot* en italique.
        [Texte](https://adresse) fait un lien, [06 12 34 56 78](tel:0612345678) un numéro à appeler.
      </p>
      <label>
        Position dans la liste
        <input type="number" value={c.ordre} onInput={champ('ordre')} />
      </label>
      <div class="actions">
        <button class="bouton">Enregistrer</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
        {c.id && (
          <button type="button" class="lien-bouton danger" onClick={supprimer}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
