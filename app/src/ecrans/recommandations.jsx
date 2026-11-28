import { useAbonnement } from '../composants/base.jsx';

// Recommandations laissées sur himmelsweg.fr : un visiteur recommande le pèlerinage à une entreprise.
// Les admins voient qui a recommandé qui, avec l'e-mail du visiteur pour le remercier.

const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function AdminRecommandations({ donnees }) {
  const recos = useAbonnement((cb) => donnees.ecouterRecommandations(cb), [donnees], null);
  if (recos === null) return <p class="discret">Chargement…</p>;
  const triees = [...recos].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const effacer = (r) => confirm(`Effacer la recommandation de ${r.de} pour ${r.entreprise} ?`) && donnees.supprimerRecommandation(r.id);

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Recommandations d’entreprises</h1>
      <p class="discret">
        Les visiteurs du site qui ont recommandé le pèlerinage à une entreprise, depuis la page Entreprises. Leur e-mail sert
        seulement à les remercier et à leur donner des nouvelles de cette recommandation.
      </p>
      {triees.length === 0 && <p class="discret">Aucune recommandation pour l’instant.</p>}
      {triees.map((r) => (
        <section class="carte" key={r.id}>
          <h2>{r.entreprise}</h2>
          <p>
            Recommandée par <strong>{r.de}</strong>
            {r.email && (
              <>
                {' '}
                · <a href={`mailto:${r.email}`}>{r.email}</a>
              </>
            )}
          </p>
          {r.mot && <p class="discret">« {r.mot} »</p>}
          <p class="discret">{date(r.date)}</p>
          <button type="button" class="lien-bouton" onClick={() => effacer(r)}>
            Effacer
          </button>
        </section>
      ))}
    </>
  );
}
