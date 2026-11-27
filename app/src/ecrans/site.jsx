// Éditeur du site himmelsweg.fr, réservé aux admins et pensé pour l'ordinateur.
// Les formulaires suivent le fichier .pages.yml (le même que Pages CMS) ; le script Google enregistre sur GitHub,
// puis le site se reconstruit tout seul.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import YAML from 'yaml';

const PHOTOS_EN_LIGNE = 'https://raw.githubusercontent.com/pelerinagehimmelsweg-creator/himmelsweg/main/site/src/assets/photos/';
const DOSSIER_PHOTOS = 'site/src/assets/photos/';
const SORTIE_PHOTOS = '../../assets/photos/';
const ADRESSE_SITE = 'https://himmelsweg.fr';
const photosEnvoyees = new Map(); // nom → aperçu local, le temps que GitHub les serve

export const enAdresse = (texte) =>
  String(texte ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Fichier → { donnees, corps }. Les pages ont un en-tête YAML entre deux lignes « --- ». */
export function decouper(contenu, estPage) {
  if (!estPage) return { donnees: YAML.parse(contenu) ?? {}, corps: '' };
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(contenu);
  if (!m) return { donnees: {}, corps: contenu };
  return { donnees: YAML.parse(m[1]) ?? {}, corps: m[2] };
}

/** On n'écrit pas les champs vides : le site les traite comme absents. */
export function nettoyer(v) {
  if (Array.isArray(v)) {
    const l = v.map(nettoyer).filter((x) => x !== undefined);
    return l.length ? l : undefined;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      const n = nettoyer(x);
      if (n !== undefined) o[k] = n;
    }
    return Object.keys(o).length ? o : undefined;
  }
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
}

export function assembler(donnees, corps, estPage) {
  const yaml = YAML.stringify(nettoyer(donnees) ?? {}, { lineWidth: 0 });
  return estPage ? `---\n${yaml}---\n${String(corps ?? '').replace(/^\n+/, '')}` : yaml;
}

/** Champs obligatoires laissés vides, avec leur nom lisible. */
export function manquants(champs, donnees, corps) {
  const res = [];
  for (const c of champs ?? []) {
    if (c.hidden) continue;
    const v = c.name === 'body' ? corps : donnees?.[c.name];
    if (c.required && (v === undefined || v === null || String(v).trim() === '')) res.push(c.label ?? c.name);
    if (c.type === 'object' && v) {
      const items = c.list ? v : [v];
      items.forEach((item, i) => manquants(c.fields, item, '').forEach((x) => res.push(`${c.label}${c.list ? ` n° ${i + 1}` : ''} : ${x}`)));
    }
  }
  return res;
}

/** Les documents modifiables, d'après .pages.yml et les fichiers lus. */
function documents(schema, fichiers) {
  const docs = [];
  for (const e of schema?.content ?? []) {
    if (e.type === 'collection') {
      fichiers
        .filter((f) => f.chemin.startsWith(e.path + '/') && f.chemin.endsWith('.md'))
        .forEach((f) => docs.push({ ...f, entree: e, page: true }));
    } else if (e.type === 'file') {
      const f = fichiers.find((x) => x.chemin === e.path);
      if (f) docs.push({ ...f, entree: e, page: false });
    }
  }
  return docs.map((d) => {
    const { donnees, corps } = decouper(d.contenu, d.page);
    return { ...d, donnees, corps, titre: d.page ? donnees.title || d.chemin.split('/').pop() : d.entree.label };
  });
}

function adressePublique(d) {
  if (!d.page) return d.entree.name === 'accueil' ? ADRESSE_SITE + '/' : null;
  return `${ADRESSE_SITE}/${d.chemin.split('/').pop().replace(/\.md$/, '')}/`;
}

export function AdminSite({ donnees }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [choix, setChoix] = useState(null);
  const [brouillon, setBrouillon] = useState(null);
  const [msg, setMsg] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = () =>
    donnees
      .siteLire()
      .then((r) => setEtat({ schema: YAML.parse(r.schema), fichiers: r.fichiers, photos: r.photos, demo: r.demo }))
      .catch((e) => setEtat({ erreur: e.message }));
  useEffect(() => {
    charger();
  }, []);

  const docs = useMemo(() => (etat.schema ? documents(etat.schema, etat.fichiers) : []), [etat]);
  const doc = brouillon ?? docs.find((d) => d.chemin === choix) ?? null;
  const modifie = !!brouillon?.modifie;

  // Ne pas perdre un texte en cours en quittant la page.
  useEffect(() => {
    if (!modifie) return;
    const garde = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', garde);
    return () => removeEventListener('beforeunload', garde);
  }, [modifie]);

  if (etat.chargement) return <p class="discret">Lecture du site…</p>;
  if (etat.erreur)
    return (
      <>
        <a class="retour" href="#/moi">
          ← Retour
        </a>
        <h1>Site internet</h1>
        <p class="info erreur">{etat.erreur}</p>
        <button type="button" class="bouton secondaire" onClick={() => setEtat({ chargement: true }) || charger()}>
          Réessayer
        </button>
      </>
    );

  const ouvrir = (chemin) => {
    if (modifie && !confirm('Les changements non enregistrés seront perdus. Continuer ?')) return;
    setBrouillon(null);
    setChoix(chemin);
    setMsg('');
    scrollTo(0, 0);
  };
  const changer = (donneesDoc, corps) => setBrouillon({ ...doc, donnees: donneesDoc, corps, modifie: true });

  const pages = docs.filter((d) => d.page).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  const autres = docs.filter((d) => !d.page);
  const collection = etat.schema.content.find((e) => e.type === 'collection');

  const nouvellePage = () => {
    const titre = prompt('Titre de la nouvelle page (il donne aussi son adresse) :');
    if (!titre?.trim()) return;
    const base = enAdresse(titre) || 'page';
    let nom = base;
    for (let i = 2; docs.some((d) => d.chemin === `${collection.path}/${nom}.md`); i++) nom = `${base}-${i}`;
    if (modifie && !confirm('Les changements non enregistrés seront perdus. Continuer ?')) return;
    setChoix(null);
    setBrouillon({ chemin: `${collection.path}/${nom}.md`, sha: null, entree: collection, page: true, nouvelle: true, titre: titre.trim(), donnees: { title: titre.trim() }, corps: '', modifie: true });
    setMsg('');
  };

  const enregistrer = async () => {
    const manque = manquants(doc.entree.fields, doc.donnees, doc.corps);
    if (manque.length) return setMsg(`À remplir avant d’enregistrer : ${manque.join(', ')}.`);
    const contenu = assembler(doc.donnees, doc.corps, doc.page);
    setEnvoi(true);
    setMsg('');
    try {
      const { sha } = await donnees.siteEcrire(doc.chemin, contenu, doc.sha);
      const fichiers = [...etat.fichiers.filter((f) => f.chemin !== doc.chemin), { chemin: doc.chemin, sha, contenu }];
      setEtat({ ...etat, fichiers });
      setChoix(doc.chemin);
      setBrouillon(null);
      setMsg(
        etat.demo
          ? 'Enregistré (démo : rien n’est publié).'
          : `Enregistré. Le site sera à jour dans 1 à 2 minutes.${doc.nouvelle ? ' Pensez à ajouter la page au menu si besoin.' : ''}`,
      );
    } catch (e) {
      setMsg(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    if (!confirm(`Supprimer la page « ${doc.titre} » du site ? Pensez aussi à l’enlever du menu.`)) return;
    try {
      await donnees.siteSupprimer(doc.chemin, doc.sha);
      setEtat({ ...etat, fichiers: etat.fichiers.filter((f) => f.chemin !== doc.chemin) });
      setChoix(null);
      setBrouillon(null);
      setMsg('Page supprimée. Elle disparaît du site dans 1 à 2 minutes.');
    } catch (e) {
      setMsg(e.message);
    }
  };

  const photos = {
    liste: etat.photos,
    async envoyer(fichier) {
      const { base64, ext, apercu } = await preparerPhoto(fichier);
      const base = enAdresse(fichier.name.replace(/\.[^.]+$/, '')) || 'photo';
      let nom = `${base}.${ext}`;
      for (let i = 2; etat.photos.includes(nom); i++) nom = `${base}-${i}.${ext}`;
      await donnees.sitePhoto(DOSSIER_PHOTOS + nom, base64);
      photosEnvoyees.set(nom, apercu);
      setEtat((x) => ({ ...x, photos: [...x.photos, nom] }));
      return SORTIE_PHOTOS + nom;
    },
  };
  const voir = doc && !doc.nouvelle ? adressePublique(doc) : null;

  return (
    <>
      <a class="retour" href="#/moi">
        ← Retour
      </a>
      <h1>Site internet</h1>
      <div class="site-grille">
        <nav class="site-menu carte" aria-label="Contenus du site">
          <h2>Pages</h2>
          <ul>
            {pages.map((d) => (
              <li key={d.chemin}>
                <button type="button" aria-current={doc?.chemin === d.chemin ? 'true' : undefined} onClick={() => ouvrir(d.chemin)}>
                  {d.titre}
                </button>
              </li>
            ))}
            {brouillon?.nouvelle && (
              <li>
                <button type="button" aria-current="true">
                  {brouillon.donnees.title || 'Nouvelle page'}
                </button>
              </li>
            )}
          </ul>
          {collection && (
            <button type="button" class="bouton petit secondaire" onClick={nouvellePage}>
              + Nouvelle page
            </button>
          )}
          <h2>Tout le site</h2>
          <ul>
            {autres.map((d) => (
              <li key={d.chemin}>
                <button type="button" aria-current={doc?.chemin === d.chemin ? 'true' : undefined} onClick={() => ouvrir(d.chemin)}>
                  {d.titre}
                </button>
              </li>
            ))}
          </ul>
          <p class="discret">
            <a href={ADRESSE_SITE} target="_blank" rel="noopener">
              Voir le site ↗
            </a>
          </p>
        </nav>

        <div class="site-edition">
          {msg && (
            <p class="info" role="status">
              {msg}
            </p>
          )}
          {!doc ? (
            <section class="carte">
              <h2>Choisissez ce que vous voulez modifier</h2>
              <p>
                À gauche : les pages du site, puis la page d’accueil, le menu et les réglages (dates, bandeau, contact). Chaque
                enregistrement met le site à jour en 1 à 2 minutes.
              </p>
              <p class="discret">Plus confortable sur un ordinateur. Les mises en forme : **gras**, *italique*, ## titre, - liste, [texte](/adresse/).</p>
            </section>
          ) : (
            <>
              <div class="site-tete">
                <h2>{doc.page ? doc.donnees.title || 'Nouvelle page' : doc.titre}</h2>
                {voir && (
                  <a href={voir} target="_blank" rel="noopener">
                    Voir en ligne ↗
                  </a>
                )}
              </div>
              {doc.page && <p class="discret">Adresse : himmelsweg.fr/{doc.chemin.split('/').pop().replace(/\.md$/, '')}/</p>}
              <section class="carte">
                <Champs champs={doc.entree.fields} valeur={doc.donnees} corps={doc.corps} photos={photos} changer={changer} />
              </section>
              <div class="site-actions">
                <button type="button" class="bouton" disabled={!modifie || envoi} onClick={enregistrer}>
                  {envoi ? 'Enregistrement…' : 'Enregistrer et publier'}
                </button>
                {modifie && !doc.nouvelle && (
                  <button type="button" class="bouton secondaire" onClick={() => setBrouillon(null)}>
                    Annuler les changements
                  </button>
                )}
                {doc.page && !doc.nouvelle && (
                  <button type="button" class="lien-bouton danger" onClick={supprimer}>
                    Supprimer la page
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Formulaire d'un document : les champs de .pages.yml, le corps de la page à part. */
function Champs({ champs, valeur, corps, photos, changer }) {
  return (champs ?? [])
    .filter((c) => !c.hidden)
    .map((c) =>
      c.name === 'body' ? (
        <Champ key={c.name} champ={c} valeur={corps} photos={photos} changer={(v) => changer(valeur, v)} />
      ) : (
        <Champ key={c.name} champ={c} valeur={valeur?.[c.name]} photos={photos} changer={(v) => changer({ ...valeur, [c.name]: v }, corps)} />
      ),
    );
}

function Champ({ champ: c, valeur, photos, changer }) {
  const id = useMemo(() => `ch-${Math.random().toString(36).slice(2)}`, []);
  const titre = (
    <label class="site-libelle" for={id}>
      {c.label ?? c.name}
      {c.required && <span class="requis"> *</span>}
    </label>
  );
  const aide = c.description && <small class="aide">{c.description}</small>;

  if (c.type === 'object') {
    if (c.list) return <ListeObjets champ={c} valeur={valeur} photos={photos} changer={changer} />;
    return (
      <fieldset class="site-groupe">
        <legend>{c.label}</legend>
        {aide}
        <Champs champs={c.fields} valeur={valeur ?? {}} photos={photos} changer={(v) => changer(v)} />
      </fieldset>
    );
  }
  let saisie;
  if (c.type === 'rich-text') saisie = <TexteRiche id={id} valeur={valeur ?? ''} changer={changer} />;
  else if (c.type === 'text') saisie = <textarea id={id} rows={4} value={valeur ?? ''} onInput={(e) => changer(e.currentTarget.value)} />;
  else if (c.type === 'number')
    saisie = <input id={id} type="number" value={valeur ?? ''} onInput={(e) => changer(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))} />;
  else if (c.type === 'boolean') saisie = <input id={id} type="checkbox" checked={!!valeur} onChange={(e) => changer(e.currentTarget.checked)} />;
  else if (c.type === 'select') {
    const options = (c.options?.values ?? []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
    saisie = (
      <select id={id} value={valeur ?? c.default ?? ''} onChange={(e) => changer(e.currentTarget.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (c.type === 'image') saisie = <ChampPhoto id={id} valeur={valeur} photos={photos} changer={changer} />;
  else saisie = <input id={id} type="text" value={valeur ?? ''} onInput={(e) => changer(e.currentTarget.value)} />;
  return (
    <div class={`site-champ type-${c.type ?? 'string'}`}>
      {titre}
      {aide}
      {saisie}
    </div>
  );
}

function ListeObjets({ champ: c, valeur, photos, changer }) {
  const items = Array.isArray(valeur) ? valeur : [];
  const maj = (i, v) => changer(items.map((x, j) => (j === i ? v : x)));
  const deplacer = (i, d) => {
    const l = [...items];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    changer(l);
  };
  const resume = (item) => Object.values(item ?? {}).find((v) => typeof v === 'string' && v.trim())?.slice(0, 60);
  return (
    <fieldset class="site-groupe">
      <legend>{c.label}</legend>
      {c.description && <small class="aide">{c.description}</small>}
      {items.map((item, i) => (
        <details key={i} class="site-element" open={items.length <= 3}>
          <summary>
            <span>
              {i + 1}. {resume(item) || '(vide)'}
            </span>
          </summary>
          <Champs champs={c.fields} valeur={item ?? {}} photos={photos} changer={(v) => maj(i, v)} />
          <div class="site-element-actions">
            <button type="button" class="lien-bouton" disabled={i === 0} onClick={() => deplacer(i, -1)}>
              ↑ Monter
            </button>
            <button type="button" class="lien-bouton" disabled={i === items.length - 1} onClick={() => deplacer(i, 1)}>
              ↓ Descendre
            </button>
            <button type="button" class="lien-bouton danger" onClick={() => confirm('Supprimer cet élément ?') && changer(items.filter((_, j) => j !== i))}>
              Supprimer
            </button>
          </div>
        </details>
      ))}
      <button type="button" class="bouton petit secondaire" onClick={() => changer([...items, {}])}>
        + Ajouter
      </button>
    </fieldset>
  );
}

const urlPhoto = (valeur) => {
  const nom = String(valeur ?? '').split('/').pop();
  return nom ? photosEnvoyees.get(nom) ?? PHOTOS_EN_LIGNE + encodeURIComponent(nom) : '';
};

function ChampPhoto({ id, valeur, photos, changer }) {
  const [galerie, setGalerie] = useState(false);
  const [envoi, setEnvoi] = useState('');
  const fichier = useRef();
  const envoyer = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    setEnvoi('Envoi de la photo…');
    try {
      changer(await photos.envoyer(f));
      setEnvoi('');
      setGalerie(false);
    } catch (err) {
      setEnvoi(err.message);
    }
  };
  return (
    <div class="site-photo">
      {valeur ? <img src={urlPhoto(valeur)} alt="" /> : <div class="site-photo-vide">Pas de photo</div>}
      <div class="site-photo-actions">
        <button id={id} type="button" class="bouton petit secondaire" onClick={() => setGalerie(!galerie)}>
          Choisir une photo
        </button>
        <button type="button" class="bouton petit secondaire" onClick={() => fichier.current.click()}>
          Envoyer une photo
        </button>
        {valeur && (
          <button type="button" class="lien-bouton danger" onClick={() => changer('')}>
            Retirer
          </button>
        )}
        <input ref={fichier} type="file" accept="image/*" hidden onChange={envoyer} />
        {envoi && <small class="aide">{envoi}</small>}
      </div>
      {galerie && (
        <div class="site-galerie">
          {photos.liste.map((nom) => (
            <button
              key={nom}
              type="button"
              title={nom}
              onClick={() => {
                changer(SORTIE_PHOTOS + nom);
                setGalerie(false);
              }}
            >
              <img src={urlPhoto(nom)} alt={nom} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Réduit les grandes photos (2000 px au plus) pour garder un site léger. */
async function preparerPhoto(f) {
  const lire = (blob) =>
    new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  let img;
  try {
    img = await createImageBitmap(f);
  } catch {
    throw new Error('Ce fichier n’est pas une photo lisible (JPEG, PNG ou WebP).');
  }
  const ratio = Math.min(1, 2000 / Math.max(img.width, img.height));
  const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[f.type];
  if (ratio === 1 && ext && f.size < 1500000) {
    const url = await lire(f);
    return { base64: url.split(',')[1], ext, apercu: url };
  }
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * ratio);
  c.height = Math.round(img.height * ratio);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  return { base64: url.split(',')[1], ext: 'jpg', apercu: url };
}

/** Texte mis en forme (Markdown) : barre d'outils, zone de saisie et aperçu côte à côte. */
function TexteRiche({ id, valeur, changer }) {
  const zone = useRef();
  const entourer = (avant, apres = avant, exemple = 'texte') => {
    const t = zone.current;
    const [d, f] = [t.selectionStart, t.selectionEnd];
    const choisi = valeur.slice(d, f) || exemple;
    changer(valeur.slice(0, d) + avant + choisi + apres + valeur.slice(f));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(d + avant.length, d + avant.length + choisi.length);
    });
  };
  const debutLigne = (prefixe) => {
    const t = zone.current;
    const d = valeur.lastIndexOf('\n', t.selectionStart - 1) + 1;
    changer(valeur.slice(0, d) + prefixe + valeur.slice(d));
    requestAnimationFrame(() => t.focus());
  };
  const lien = () => {
    const adresse = prompt('Adresse du lien (ex. /programme/ ou https://…) :');
    if (adresse) entourer('[', `](${adresse.trim()})`, 'texte du lien');
  };
  return (
    <div class="texte-riche">
      <div class="barre-outils" role="toolbar" aria-label="Mise en forme">
        <button type="button" onClick={() => debutLigne('## ')} title="Titre">
          Titre
        </button>
        <button type="button" onClick={() => entourer('**')} title="Gras">
          <strong>G</strong>
        </button>
        <button type="button" onClick={() => entourer('*')} title="Italique">
          <em>I</em>
        </button>
        <button type="button" onClick={lien} title="Lien">
          Lien
        </button>
        <button type="button" onClick={() => debutLigne('- ')} title="Liste à puces">
          • Liste
        </button>
      </div>
      <div class="texte-riche-corps">
        <textarea id={id} ref={zone} rows={12} value={valeur} onInput={(e) => changer(e.currentTarget.value)} />
        <div class="apercu" aria-label="Aperçu">
          <ApercuMarkdown texte={valeur} />
        </div>
      </div>
    </div>
  );
}

function enLigne(texte) {
  const res = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\(([^)\s]+)\)/g;
  let i = 0;
  let m;
  while ((m = re.exec(texte))) {
    if (m.index > i) res.push(texte.slice(i, m.index));
    if (m[1]) res.push(<strong>{m[1]}</strong>);
    else if (m[2]) res.push(<em>{m[2]}</em>);
    else res.push(<a href={m[4].startsWith('/') ? ADRESSE_SITE + m[4] : m[4]} target="_blank" rel="noopener">{m[3]}</a>);
    i = re.lastIndex;
  }
  if (i < texte.length) res.push(texte.slice(i));
  return res;
}

/** Aperçu approximatif du rendu sur le site. */
export function ApercuMarkdown({ texte }) {
  const blocs = String(texte ?? '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocs.length) return <p class="discret">Aperçu</p>;
  return blocs.map((b, i) => {
    const lignes = b.split('\n');
    const t = /^(#{1,4})\s+(.*)$/.exec(b);
    if (t && lignes.length === 1) return t[1].length <= 2 ? <h3 key={i}>{enLigne(t[2])}</h3> : <h4 key={i}>{enLigne(t[2])}</h4>;
    if (lignes.every((l) => /^\s*[-*]\s+/.test(l))) return <ul key={i}>{lignes.map((l, j) => <li key={j}>{enLigne(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
    if (lignes.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i}>{lignes.map((l, j) => <li key={j}>{enLigne(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
    if (lignes.every((l) => l.startsWith('>'))) return <blockquote key={i}>{enLigne(lignes.map((l) => l.replace(/^>\s?/, '')).join(' '))}</blockquote>;
    return <p key={i}>{enLigne(lignes.join(' '))}</p>;
  });
}
