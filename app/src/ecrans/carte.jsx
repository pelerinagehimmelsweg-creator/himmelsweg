// Onglet Carte : tracé du parcours, repères, ma position, et (pour la logistique) la position des chefs.
// Chargé seulement à l'ouverture de l'onglet (la bibliothèque de carte est un peu lourde).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { COULEURS, REPERES, decoder, ilYa, lireGpx, nouvelleTrace, repereDe } from '../donnees/carte.js';
import { JOURS, aujourdhui, momentDu } from '../donnees/modele.js';
import { changerPartage, ecouterPartage, peutPartager } from '../donnees/partage.js';

const NOMS_JOURS = Object.values(JOURS);
const CENTRE = [48.19, 7.35];
const echapper = (t = '') => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const iconeRepere = (type, choisi) => {
  const r = repereDe(type);
  return L.divIcon({
    className: '',
    html: `<span class="repere${choisi ? ' choisi' : ''}" style="background:${r.couleur}">${r.signe}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
};
const iconeChef = (vieux) =>
  L.divIcon({ className: '', html: `<span class="pos-chef${vieux ? ' vieux' : ''}">Chef</span>`, iconSize: [44, 22], iconAnchor: [22, 11] });

export function Carte({ donnees, session }) {
  const roles = session.roles ?? [];
  const logistique = session.estAdmin || roles.includes('logistique');
  const traces = useAbonnement((cb) => donnees.ecouterListe('traces', cb), [donnees], []);
  const reperes = useAbonnement((cb) => donnees.ecouterListe('reperes', cb), [donnees], []);
  const positions = useAbonnement((cb) => (logistique ? donnees.ecouterListe('positions', cb) : (cb([]), () => {})), [donnees, logistique], []);
  const chapitres = useAbonnement((cb) => donnees.ecouterChapitres(cb), [donnees], []);
  const [jour, setJour] = useState(momentDu() === 'pendant' ? JOURS[aujourdhui()] ?? '' : '');
  const [brouillon, setBrouillon] = useState(null); // repère en cours d'ajout ou de modification
  const [ajout, setAjout] = useState(false);
  const [moi, setMoi] = useState(null); // { lat, lng, precision } ou { erreur }
  const [suivre, setSuivre] = useState(false);

  const div = useRef(null);
  const carte = useRef(null);
  const calques = useRef(null);
  const etat = useRef({});
  Object.assign(etat.current, { ajout, brouillon });

  // Création de la carte, une seule fois.
  useEffect(() => {
    const m = L.map(div.current, { zoomControl: true, attributionControl: true }).setView(CENTRE, 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    calques.current = { traces: L.layerGroup().addTo(m), reperes: L.layerGroup().addTo(m), chefs: L.layerGroup().addTo(m), moi: L.layerGroup().addTo(m) };
    m.on('click', (e) => {
      const { ajout: a, brouillon: b } = etat.current;
      const pos = { lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 };
      if (b) setBrouillon({ ...b, ...pos });
      else if (a) {
        setAjout(false);
        setBrouillon({ type: 'eau', nom: '', note: '', jour: '', ...pos });
      }
    });
    carte.current = m;
    // La carte est dans une page qui défile : on recalcule sa taille quand elle s'affiche.
    setTimeout(() => m.invalidateSize(), 0);
    return () => m.remove();
  }, []);

  const tracesVues = traces.filter((t) => !jour || !t.jour || t.jour === jour);
  const reperesVus = reperes.filter((r) => !jour || !r.jour || r.jour === jour);

  // Traces
  useEffect(() => {
    const g = calques.current.traces;
    g.clearLayers();
    const lignes = tracesVues.map((t) =>
      L.polyline(decoder(t.trace), { color: t.couleur || COULEURS[0], weight: 5, opacity: 0.85 }).bindTooltip(echapper(t.nom), { sticky: true }).addTo(g),
    );
    // On recadre seulement quand on change de jour ou que les tracés changent (pas à chaque mise à jour).
    const cle = jour + tracesVues.map((t) => t.id + t.trace.length).join();
    if (lignes.length && etat.current.cadre !== cle) {
      carte.current.fitBounds(L.featureGroup(lignes).getBounds(), { padding: [20, 20] });
      etat.current.cadre = cle;
    }
  }, [traces, jour]);

  // Repères
  useEffect(() => {
    const g = calques.current.reperes;
    g.clearLayers();
    for (const r of reperesVus) {
      if (brouillon?.id === r.id) continue;
      const mk = L.marker([r.lat, r.lng], { icon: iconeRepere(r.type), title: r.nom || repereDe(r.type).nom })
        .bindPopup(
          `<strong>${echapper(r.nom || repereDe(r.type).nom)}</strong><br><small>${echapper(repereDe(r.type).nom)}${r.jour ? ` · ${echapper(r.jour)}` : ''}</small>${
            r.note ? `<br>${echapper(r.note)}` : ''
          }<br><a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" rel="noopener">Itinéraire</a>`,
        )
        .addTo(g);
      if (logistique) mk.on('click', () => !etat.current.brouillon && setBrouillon({ ...r }));
    }
    if (brouillon) L.marker([brouillon.lat, brouillon.lng], { icon: iconeRepere(brouillon.type, true) }).addTo(g);
  }, [reperes, jour, brouillon]);

  // Position des chefs (logistique et admins)
  useEffect(() => {
    const g = calques.current.chefs;
    g.clearLayers();
    for (const p of positions) {
      const vieux = Date.now() - new Date(p.maj).getTime() > 30 * 60000;
      const ch = chapitres.find((c) => c.id === p.chapitre)?.nom;
      L.marker([p.lat, p.lng], { icon: iconeChef(vieux), zIndexOffset: 500 })
        .bindPopup(`<strong>${echapper(p.nom)}</strong>${ch ? `<br>${echapper(ch)}` : ''}<br><small>${ilYa(p.maj)}</small>`)
        .addTo(g);
    }
  }, [positions, chapitres]);

  // Ma position (seulement sur mon téléphone, jamais envoyée)
  useEffect(() => {
    if (!suivre) return;
    if (!navigator.geolocation) {
      setMoi({ erreur: 'Votre téléphone ne donne pas sa position.' });
      return;
    }
    let premier = true;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        setMoi(pos);
        if (premier) carte.current.setView([pos.lat, pos.lng], Math.max(carte.current.getZoom(), 15));
        premier = false;
      },
      (e) =>
        setMoi({ erreur: e.code === 1 ? 'Position refusée. Autorisez la localisation pour l’app dans les réglages du téléphone.' : 'Position introuvable pour l’instant.' }),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [suivre]);
  useEffect(() => {
    const g = calques.current.moi;
    g.clearLayers();
    if (!moi?.lat) return;
    if (moi.precision < 2000) L.circle([moi.lat, moi.lng], { radius: moi.precision, color: '#1f6fb2', weight: 1, fillOpacity: 0.1 }).addTo(g);
    L.circleMarker([moi.lat, moi.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1f6fb2', fillOpacity: 1 }).bindTooltip('Vous êtes ici').addTo(g);
  }, [moi]);

  const centrerSurMoi = () => {
    if (!suivre) setSuivre(true);
    else if (moi?.lat) carte.current.setView([moi.lat, moi.lng], Math.max(carte.current.getZoom(), 15));
  };
  const centrer = (lat, lng) => {
    carte.current.setView([lat, lng], 15);
    div.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <>
      <h1>Carte</h1>
      <div class="jours" role="group" aria-label="Jour affiché">
        {['', ...NOMS_JOURS].map((j) => (
          <button key={j} type="button" class="puce" aria-pressed={jour === j} onClick={() => setJour(j)}>
            {j ? j.split(' ').slice(0, 2).join(' ') : 'Tout'}
          </button>
        ))}
      </div>

      <div class={`carte-zone${ajout || brouillon ? ' pointe' : ''}`}>
        <div ref={div} class="carte-leaflet" />
        <button type="button" class="bouton-moi" onClick={centrerSurMoi} aria-label="Me situer sur la carte" title="Me situer">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
        {ajout && <div class="carte-consigne">Touchez la carte à l’endroit du repère</div>}
      </div>
      {moi?.erreur && <p class="alerte">{moi.erreur}</p>}

      {traces.length === 0 && (
        <p class="discret">
          Le tracé du parcours sera affiché ici dès qu’il sera prêt.{' '}
          {logistique ? 'Ajoutez le fichier GPX plus bas.' : ''}
        </p>
      )}
      <Legende traces={tracesVues} reperes={reperesVus} />
      <p class="discret petit-texte">
        Hors ligne : le tracé et les repères restent visibles. Le fond de carte n’est gardé que pour les endroits déjà affichés : ouvrez la carte et
        zoomez sur le parcours avant de partir.
      </p>

      {peutPartager(donnees, session) && <PartageChef donnees={donnees} session={session} />}

      {brouillon && (
        <EditeurRepere
          donnees={donnees}
          r={brouillon}
          changer={setBrouillon}
          fermer={() => setBrouillon(null)}
        />
      )}

      {logistique && (
        <>
          {!brouillon && (
            <div class="actions">
              <button
                type="button"
                class="bouton"
                onClick={() => {
                  if (!ajout) div.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  setAjout(!ajout);
                }}
              >
                {ajout ? 'Annuler' : 'Ajouter un repère'}
              </button>
            </div>
          )}
          <p class="discret petit-texte">Pour modifier ou déplacer un repère, touchez-le sur la carte.</p>
          <PositionsChefs donnees={donnees} session={session} positions={positions} chapitres={chapitres} centrer={centrer} />
          <ImportTraces donnees={donnees} traces={traces} />
        </>
      )}
    </>
  );
}

function Legende({ traces, reperes }) {
  const types = REPERES.filter((r) => reperes.some((x) => x.type === r.id));
  if (!traces.length && !types.length) return null;
  return (
    <ul class="legende">
      {traces.map((t) => (
        <li key={t.id}>
          <span class="trait" style={{ background: t.couleur }} />
          {t.nom}
          {t.km ? <small> · {String(t.km).replace('.', ',')} km</small> : null}
        </li>
      ))}
      {types.map((r) => (
        <li key={r.id}>
          <span class="repere mini" style={{ background: r.couleur }}>
            {r.signe}
          </span>
          {r.nom}
        </li>
      ))}
    </ul>
  );
}

function PartageChef({ donnees, session }) {
  const on = useAbonnement(ecouterPartage, [], false);
  const [enCours, setEnCours] = useState(false);
  const basculer = async () => {
    setEnCours(true);
    if (!on) {
      // Demande l'autorisation tout de suite, pour que le chef voie la fenêtre du téléphone.
      await new Promise((ok) => navigator.geolocation.getCurrentPosition(ok, ok, { timeout: 15000 }));
    }
    await changerPartage(donnees, session, !on);
    setEnCours(false);
  };
  return (
    <section class="carte">
      <h2>Ma position de chef</h2>
      <p class="discret">
        La logistique voit où se trouve votre chapitre, pendant les trois jours seulement. Votre position est envoyée tant que l’app est ouverte
        sur votre téléphone.
      </p>
      <label class="interrupteur">
        <input type="checkbox" checked={on} disabled={enCours} onChange={basculer} />
        <span>{on ? 'Position partagée avec la logistique' : 'Partager ma position avec la logistique'}</span>
      </label>
    </section>
  );
}

function PositionsChefs({ donnees, session, positions, chapitres, centrer }) {
  const tries = [...positions].sort((a, b) => String(b.maj).localeCompare(String(a.maj)));
  const effacer = async () => {
    if (!confirm('Effacer toutes les positions des chefs ?')) return;
    for (const p of positions) await donnees.supprimerElement('positions', p.id);
  };
  return (
    <section class="carte">
      <h2>Position des chefs</h2>
      {tries.length ? (
        <ul class="elements">
          {tries.map((p) => (
            <li key={p.id}>
              <button type="button" class="lien-ligne" onClick={() => centrer(p.lat, p.lng)}>
                <span>
                  <strong>{p.nom}</strong>
                  <small class="discret"> · {chapitres.find((c) => c.id === p.chapitre)?.nom ?? 'Sans chapitre'}</small>
                </span>
                <small class="discret">{ilYa(p.maj)}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="discret">Aucun chef ne partage sa position pour l’instant. Ils peuvent l’activer depuis l’onglet Carte, pendant le pèlerinage.</p>
      )}
      {session.estAdmin && positions.length > 0 && (
        <button type="button" class="lien-bouton danger" onClick={effacer}>
          Effacer toutes les positions
        </button>
      )}
    </section>
  );
}

function EditeurRepere({ donnees, r, changer, fermer }) {
  const [erreur, setErreur] = useState('');
  const champ = (k) => (e) => changer({ ...r, [k]: e.currentTarget.value });
  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await donnees.enregistrerElement('reperes', { ...r, nom: r.nom.trim(), note: (r.note ?? '').trim() });
      fermer();
    } catch (err) {
      setErreur(err.message);
    }
  };
  const supprimer = async () => {
    if (!confirm('Supprimer ce repère ?')) return;
    await donnees.supprimerElement('reperes', r.id);
    fermer();
  };
  return (
    <form class="formulaire carte" onSubmit={enregistrer}>
      <h2>{r.id ? 'Modifier le repère' : 'Nouveau repère'}</h2>
      <p class="discret petit-texte">Touchez la carte pour le déplacer.</p>
      {erreur && <p class="alerte">{erreur}</p>}
      <div class="types-repere" role="radiogroup" aria-label="Type">
        {REPERES.map((t) => (
          <button key={t.id} type="button" class="puce" role="radio" aria-checked={r.type === t.id} aria-pressed={r.type === t.id} onClick={() => changer({ ...r, type: t.id })}>
            <span class="repere mini" style={{ background: t.couleur }}>
              {t.signe}
            </span>
            {t.nom}
          </button>
        ))}
      </div>
      <label>
        Nom <span class="discret">(facultatif)</span>
        <input value={r.nom} onInput={champ('nom')} placeholder={repereDe(r.type).nom} />
      </label>
      <label>
        Précision <span class="discret">(facultatif)</span>
        <input value={r.note ?? ''} onInput={champ('note')} placeholder="Ex. : derrière la salle des fêtes" />
      </label>
      <label>
        Jour
        <select value={r.jour ?? ''} onChange={champ('jour')}>
          <option value="">Les trois jours</option>
          {NOMS_JOURS.map((j) => (
            <option key={j}>{j}</option>
          ))}
        </select>
      </label>
      <div class="actions">
        <button class="bouton">Enregistrer</button>
        <button type="button" class="bouton secondaire" onClick={fermer}>
          Annuler
        </button>
        {r.id && (
          <button type="button" class="lien-bouton danger" onClick={supprimer}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

function ImportTraces({ donnees, traces }) {
  const [lus, setLus] = useState([]); // traces lues dans les fichiers, pas encore enregistrées
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const tries = [...traces].sort((a, b) => NOMS_JOURS.indexOf(a.jour) - NOMS_JOURS.indexOf(b.jour));

  const lire = async (e) => {
    setErreur('');
    const champ = e.currentTarget;
    const res = [];
    for (const f of [...champ.files]) {
      try {
        const nomFichier = f.name.replace(/\.gpx$/i, '');
        for (const t of lireGpx(await f.text(), nomFichier)) res.push(t);
      } catch (err) {
        setErreur(`${f.name} : ${err.message}`);
      }
    }
    champ.value = '';
    // Devine le jour : une trace par jour dans l'ordre, ou une seule trace pour tout le parcours.
    setLus(res.map((t, i) => ({ ...t, jour: res.length === 3 ? NOMS_JOURS[i] : res.length === 1 ? '' : NOMS_JOURS[i] ?? '' })));
  };
  const enregistrer = async () => {
    setEnCours(true);
    try {
      for (const t of lus) {
        const i = NOMS_JOURS.indexOf(t.jour);
        await donnees.enregistrerElement('traces', nouvelleTrace(t, t.jour, COULEURS[i < 0 ? 0 : i]));
      }
      setLus([]);
    } catch (err) {
      setErreur(err.message);
    }
    setEnCours(false);
  };
  const changer = (i, k, v) => setLus(lus.map((t, j) => (j === i ? { ...t, [k]: v } : t)));

  return (
    <section class="carte">
      <h2>Tracé du parcours (GPX)</h2>
      {tries.length > 0 && (
        <ul class="elements">
          {tries.map((t) => (
            <li key={t.id} class="ligne-trace">
              <span class="trait" style={{ background: t.couleur }} />
              <span>
                {t.nom}
                <small class="discret">
                  {' '}
                  · {t.jour || 'Tout le parcours'}
                  {t.km ? ` · ${String(t.km).replace('.', ',')} km` : ''}
                </small>
              </span>
              <button
                type="button"
                class="lien-bouton danger"
                onClick={() => confirm(`Supprimer le tracé « ${t.nom} » ?`) && donnees.supprimerElement('traces', t.id)}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="discret">Un seul fichier pour tout le parcours, ou un fichier par jour. Vous pouvez en choisir plusieurs à la fois.</p>
      {erreur && <p class="alerte">{erreur}</p>}
      {lus.length > 0 ? (
        <div class="import-gpx">
          {lus.map((t, i) => (
            <div key={i} class="champ-import">
              <label>
                Nom
                <input value={t.nom} onInput={(e) => changer(i, 'nom', e.currentTarget.value)} />
              </label>
              <label>
                Jour
                <select value={t.jour} onChange={(e) => changer(i, 'jour', e.currentTarget.value)}>
                  <option value="">Tout le parcours</option>
                  {NOMS_JOURS.map((j) => (
                    <option key={j}>{j}</option>
                  ))}
                </select>
              </label>
              <small class="discret">{t.points.length} points</small>
            </div>
          ))}
          <div class="actions">
            <button type="button" class="bouton" disabled={enCours} onClick={enregistrer}>
              {enCours ? 'Enregistrement…' : lus.length > 1 ? `Ajouter ces ${lus.length} tracés` : 'Ajouter ce tracé'}
            </button>
            <button type="button" class="bouton secondaire" onClick={() => setLus([])}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <label class="bouton secondaire fichier">
          Choisir un fichier GPX
          <input type="file" accept=".gpx,application/gpx+xml" multiple onChange={lire} />
        </label>
      )}
    </section>
  );
}
