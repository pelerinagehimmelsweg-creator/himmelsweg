// Textes écrits par les admins : onglets Infos et Prier, mot de l'accueil, textes d'après le pèlerinage.
import { useEffect, useState } from 'preact/hooks';
import { Texte, useAbonnement } from '../composants/base.jsx';
import { RUBRIQUES, droits, rubriqueDe } from '../donnees/modele.js';

const TITRES = {
  infos: { titre: 'Infos pratiques', intro: 'Tout ce qu’il faut savoir pour le pèlerinage. Disponible même sans réseau.' },
  prier: { titre: 'Prier', intro: 'Les chants et les prières du pèlerinage, disponibles même sans réseau.' },
};

export const textesDe = (tous, rubrique) => (tous ?? []).filter((c) => rubriqueDe(c) === rubrique);

/** Onglet Infos ou Prier : un sommaire, puis chaque texte. */
export function Rubrique({ donnees, session, rubrique, ancre }) {
  const tous = useAbonnement((cb) => donnees.ecouterContenus(cb), [donnees], null);
  const [edition, setEdition] = useState(null);
  const peutModifier = droits(session).modifierContenus;
  const liste = textesDe(tous, rubrique);
  const t = TITRES[rubrique];

  useEffect(() => {
    if (ancre && tous) document.getElementById(ancre)?.scrollIntoView({ block: 'start' });
  }, [ancre, !!tous]);

  if (edition) return <EditeurContenu donnees={donnees} contenu={edition} fermer={() => setEdition(null)} />;

  return (
    <>
      <h1>{t.titre}</h1>
      <p class="discret">{t.intro}</p>
      {tous === null && <p class="discret">Chargement…</p>}
      {tous !== null && liste.length === 0 && <p class="discret">Rien pour l’instant.</p>}
      {liste.length > 2 && (
        <nav class="sommaire carte" aria-label="Sommaire">
          {liste.map((c) => (
            <a key={c.id} href={`#/${rubrique}/${c.id}`}>
              {c.titre}
            </a>
          ))}
        </nav>
      )}
      {liste.map((c) => (
        <TexteAdmin key={c.id} c={c} peutModifier={peutModifier} modifier={() => setEdition(c)} />
      ))}
      {peutModifier && (
        <button type="button" class="bouton secondaire" onClick={() => setEdition(nouveau(rubrique, liste))}>
          Ajouter une rubrique
        </button>
      )}
    </>
  );
}

export const nouveau = (rubrique, liste) => ({ rubrique, titre: '', texte: '', ordre: (liste.at(-1)?.ordre ?? 0) + 1 });

export function TexteAdmin({ c, peutModifier, modifier, titreNiveau = 2 }) {
  const H = `h${titreNiveau}`;
  return (
    <article class="carte" id={c.id}>
      <div class="carte-titre">
        <H>{c.titre}</H>
        {peutModifier && (
          <button type="button" class="lien-bouton" onClick={modifier}>
            Modifier
          </button>
        )}
      </div>
      <Texte texte={c.texte} />
    </article>
  );
}

export function EditeurContenu({ donnees, contenu, fermer }) {
  const [c, setC] = useState({ ...contenu, rubrique: rubriqueDe(contenu) });
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
      <h1>{c.id ? 'Modifier le texte' : 'Nouveau texte'}</h1>
      {erreur && <p class="alerte">{erreur}</p>}
      <label>
        Titre
        <input required value={c.titre} onInput={champ('titre')} />
      </label>
      <label>
        Où l’afficher
        <select value={c.rubrique} onChange={champ('rubrique')}>
          {RUBRIQUES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.titre}
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
