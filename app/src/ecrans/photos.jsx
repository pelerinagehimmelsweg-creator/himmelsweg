// Photos du pèlerinage : dépôt par les pèlerins, tri par un admin, galerie pour les inscrits.
import { useEffect, useState } from 'preact/hooks';
import { useAbonnement, useEnLigne } from '../composants/base.jsx';
import { momentDu } from '../donnees/modele.js';
import { deposer, ecouterEnvoi, envoyer, retirerDeLaFile } from '../donnees/photos.js';

const PAR_PAGE = 30;
const vignette = (p) => `data:image/jpeg;base64,${p.vignette}`;
const enGrand = (p) => (p.fichier ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(p.fichier)}&sz=w2000` : vignette(p));
const quand = (iso) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
const ETATS = { a_trier: ['En attente de tri', 'attente'], publiee: ['Dans la galerie', 'ok'], refusee: ['Non retenue', ''] };

export function Photos({ donnees, session }) {
  const admin = !!session.estAdmin;
  const ouvert = admin || donnees.mode === 'demo' || momentDu() !== 'avant';
  const [n, setN] = useState(PAR_PAGE);
  const galerie = useAbonnement((cb) => donnees.ecouterPhotos('galerie', n, cb), [donnees, n], null);
  const miennes = useAbonnement((cb) => donnees.ecouterPhotos('miennes', 500, cb), [donnees], []);
  const [vue, setVue] = useState(null); // index dans la galerie

  return (
    <>
      <h1>Photos</h1>
      {ouvert ? (
        <Depot donnees={donnees} session={session} miennes={miennes} />
      ) : (
        <p class="encart">Le dépôt des photos ouvrira le vendredi 7 mai, premier jour du pèlerinage.</p>
      )}

      {admin && <ATrier donnees={donnees} />}

      <section>
        <h2>Galerie</h2>
        {galerie === null ? (
          <p class="discret">Chargement…</p>
        ) : galerie.length === 0 ? (
          <p class="discret">Les photos choisies par les organisateurs apparaîtront ici.</p>
        ) : (
          <>
            <div class="grille-photos">
              {galerie.map((p, i) => (
                <button key={p.id} type="button" class="photo" onClick={() => setVue(i)} aria-label={`Photo de ${p.nom}`}>
                  <img src={vignette(p)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
            {galerie.length >= n && (
              <button type="button" class="bouton secondaire" onClick={() => setN(n + PAR_PAGE)}>
                Voir plus de photos
              </button>
            )}
          </>
        )}
      </section>

      {vue !== null && galerie?.[vue] && (
        <Visionneuse
          photos={galerie}
          i={vue}
          aller={setVue}
          fermer={() => setVue(null)}
          retirer={admin ? (p) => donnees.trierPhoto(p.id, 'refusee') : null}
        />
      )}
    </>
  );
}

function Depot({ donnees, session, miennes }) {
  const envoi = useAbonnement(ecouterEnvoi, [], { attente: [], envoi: false });
  const enLigne = useEnLigne();
  const [erreurs, setErreurs] = useState([]);
  const [preparation, setPreparation] = useState(0);
  const attente = envoi.attente.filter((p) => p.uid === session.id);
  const bloquees = attente.filter((p) => p.erreur);
  const enCours = attente.length - bloquees.length;

  useEffect(() => {
    if (enLigne) envoyer(donnees, session.id);
  }, [enLigne]);

  const choisir = async (e) => {
    const champ = e.currentTarget;
    const fichiers = [...champ.files];
    champ.value = '';
    setErreurs([]);
    setPreparation(fichiers.length);
    setErreurs(await deposer(donnees, session.id, fichiers));
    setPreparation(0);
  };
  const retirer = async (p) => {
    if (!confirm('Retirer cette photo ? Elle sera supprimée du Drive.')) return;
    try {
      await donnees.supprimerPhoto(p.id);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <section class="carte">
      <h2>Déposer mes photos</h2>
      <p class="discret">
        Elles sont allégées sur votre téléphone puis rangées dans le Drive du pèlerinage. Les organisateurs choisissent celles qui vont dans la
        galerie.
      </p>
      <label class="bouton fichier">
        {preparation ? `Préparation de ${preparation} photo${preparation > 1 ? 's' : ''}…` : 'Choisir des photos'}
        <input type="file" accept="image/*" multiple onChange={choisir} disabled={!!preparation} />
      </label>
      {erreurs.map((m) => (
        <p key={m} class="alerte">
          {m}
        </p>
      ))}

      {enCours > 0 && (
        <p class="info file-envoi">
          {enCours} photo{enCours > 1 ? 's' : ''} à envoyer.{' '}
          {!enLigne ? 'Pas de réseau : elles partiront toutes seules dès qu’il revient, même si vous fermez l’app.' : envoi.envoi ? 'Envoi en cours…' : ''}
        </p>
      )}
      {bloquees.map((p) => (
        <div key={p.id} class="alerte photo-bloquee">
          <img src={vignette(p)} alt="" />
          <span>{p.erreur}</span>
          <button type="button" class="lien-bouton" onClick={() => retirerDeLaFile(p.id)}>
            Retirer
          </button>
        </div>
      ))}

      {(attente.length > 0 || miennes.length > 0) && (
        <>
          <h3 class="sous-titre">Mes photos</h3>
          <div class="grille-photos petite">
            {attente
              .filter((p) => !p.erreur)
              .map((p) => (
                <div key={p.id} class="photo">
                  <img src={vignette(p)} alt="" />
                  <span class="etiquette attente">À envoyer</span>
                </div>
              ))}
            {miennes.map((p) => (
              <div key={p.id} class="photo">
                <img src={vignette(p)} alt="" loading="lazy" />
                <span class={`etiquette ${ETATS[p.statut]?.[1] ?? ''}`}>{ETATS[p.statut]?.[0]}</span>
                {p.statut === 'a_trier' && (
                  <button type="button" class="photo-retirer" aria-label="Retirer cette photo" onClick={() => retirer(p)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ATrier({ donnees }) {
  const [n, setN] = useState(PAR_PAGE);
  const photos = useAbonnement((cb) => donnees.ecouterPhotos('a_trier', n, cb), [donnees, n], []);
  const [enCours, setEnCours] = useState({});
  const [erreur, setErreur] = useState('');
  const trier = async (p, statut) => {
    setEnCours((e) => ({ ...e, [p.id]: statut }));
    setErreur('');
    try {
      await donnees.trierPhoto(p.id, statut);
    } catch (err) {
      setErreur(err.message);
    }
    setEnCours((e) => ({ ...e, [p.id]: null }));
  };
  return (
    <section class="carte sensible">
      <div class="carte-titre">
        <h2>À trier</h2>
        <span class="discret">{photos.length >= n ? `${n}+` : photos.length}</span>
      </div>
      {erreur && <p class="alerte">{erreur}</p>}
      {photos.length === 0 ? (
        <p class="discret">Aucune photo à trier.</p>
      ) : (
        <>
          <p class="discret">« Garder » la met dans la galerie de l’app. « Refuser » la range dans le dossier « Non retenues » du Drive.</p>
          <div class="grille-tri">
            {photos.map((p) => (
              <div key={p.id} class="tri">
                <a href={enGrand(p)} target="_blank" rel="noopener">
                  <img src={vignette(p)} alt={`Photo de ${p.nom}`} loading="lazy" />
                </a>
                <small>{p.nom}</small>
                <div class="tri-boutons">
                  <button type="button" class="bouton petit" disabled={!!enCours[p.id]} onClick={() => trier(p, 'publiee')}>
                    {enCours[p.id] === 'publiee' ? '…' : 'Garder'}
                  </button>
                  <button type="button" class="bouton petit secondaire" disabled={!!enCours[p.id]} onClick={() => trier(p, 'refusee')}>
                    {enCours[p.id] === 'refusee' ? '…' : 'Refuser'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {photos.length >= n && (
            <button type="button" class="lien-bouton" onClick={() => setN(n + PAR_PAGE)}>
              Voir les suivantes
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Visionneuse({ photos, i, aller, fermer, retirer }) {
  const p = photos[i];
  const [src, setSrc] = useState(enGrand(p));
  useEffect(() => setSrc(enGrand(p)), [p.id]);
  useEffect(() => {
    const touche = (e) => {
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowRight' && i < photos.length - 1) aller(i + 1);
      if (e.key === 'ArrowLeft' && i > 0) aller(i - 1);
    };
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, [i, photos.length]);
  return (
    <div class="visionneuse" role="dialog" aria-modal="true" aria-label="Photo">
      <button type="button" class="visionneuse-fermer" onClick={fermer} aria-label="Fermer">
        ×
      </button>
      {/* Sans réseau, la photo en grand ne charge pas : on garde la vignette. */}
      <img src={src} alt={`Photo de ${p.nom}`} onError={() => setSrc(vignette(p))} style={{ backgroundImage: `url(${vignette(p)})` }} />
      <div class="visionneuse-bas">
        <button type="button" class="visionneuse-fleche" disabled={i === 0} onClick={() => aller(i - 1)} aria-label="Photo précédente">
          ‹
        </button>
        <div>
          <strong>{p.nom}</strong>
          <small>{quand(p.prise)}</small>
          <span class="visionneuse-liens">
            {p.fichier && (
              <a href={`https://drive.google.com/file/d/${encodeURIComponent(p.fichier)}/view`} target="_blank" rel="noopener">
                Télécharger
              </a>
            )}
            {retirer && (
              <button
                type="button"
                class="lien-bouton"
                onClick={async () => {
                  if (!confirm('Retirer cette photo de la galerie ?')) return;
                  await retirer(p);
                  fermer();
                }}
              >
                Retirer de la galerie
              </button>
            )}
          </span>
        </div>
        <button type="button" class="visionneuse-fleche" disabled={i === photos.length - 1} onClick={() => aller(i + 1)} aria-label="Photo suivante">
          ›
        </button>
      </div>
    </div>
  );
}
