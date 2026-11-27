// Affichage d'une question du questionnaire, selon son type. Sert à l'inscription,
// à la modification de ses réponses et à l'ajout d'un pèlerin par un admin.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Texte } from './base.jsx';

export function ChampQuestion({ q, valeur, changer, erreur, verrouille = false, nomSignataire = '' }) {
  const id = `q-${q.id}`;
  const aide = q.aide && <small class="aide">{q.aide}</small>;
  const err = erreur && (
    <small class="erreur" role="alert">
      {erreur}
    </small>
  );
  const etoile = q.obligatoire && q.type !== 'case' && q.type !== 'info' && <span class="etoile" aria-hidden="true"> *</span>;
  const val = (e) => changer(e.currentTarget.value);

  if (q.type === 'info') {
    return (
      <div class="champ info-bloc">
        {q.libelle && <strong>{q.libelle}</strong>}
        <Texte texte={q.texte || q.aide || ''} />
      </div>
    );
  }
  if (q.type === 'case') {
    return (
      <div class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
        {q.texte && <Texte texte={q.texte} />}
        <label class="case">
          <input type="checkbox" checked={valeur === true} disabled={verrouille} onChange={(e) => changer(e.currentTarget.checked)} />
          <span>{q.libelle}</span>
        </label>
        {aide}
        {err}
      </div>
    );
  }
  if (q.type === 'signature') {
    return (
      <div class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
        <span class="libelle">
          {q.libelle}
          {etoile}
        </span>
        {q.texte && (
          <div class="document">
            <Texte texte={q.texte} />
          </div>
        )}
        {aide}
        {verrouille ? (
          valeur?.image ? (
            <img class="signature-image" src={valeur.image} alt={`Signature de ${valeur.signataire ?? ''}`} />
          ) : (
            <p class="discret">Pas de signature.</p>
          )
        ) : (
          <Signature valeur={valeur} changer={changer} nomParDefaut={nomSignataire} />
        )}
        {err}
      </div>
    );
  }
  if (q.type === 'note') {
    return (
      <fieldset class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
        <legend class="libelle">
          {q.libelle}
          {etoile}
        </legend>
        {aide}
        <div class="etoiles" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={valeur === n}
              aria-label={`${n} sur 5`}
              class={valeur >= n ? 'pleine' : ''}
              disabled={verrouille}
              onClick={() => changer(valeur === n ? null : n)}
            >
              ★
            </button>
          ))}
        </div>
        {err}
      </fieldset>
    );
  }
  if (q.type === 'oui_non' || q.type === 'choix' || q.type === 'choix_multiples') {
    const options = q.type === 'oui_non' ? ['Oui', 'Non'] : (q.options ?? []);
    const multiple = q.type === 'choix_multiples';
    const coche = (o) => (multiple ? (valeur ?? []).includes(o) : valeur === o);
    const basculer = (o) => {
      if (!multiple) return changer(o);
      const s = new Set(valeur ?? []);
      s.has(o) ? s.delete(o) : s.add(o);
      changer(options.filter((x) => s.has(x)));
    };
    if (!multiple && options.length > 6) {
      return (
        <label class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
          <span class="libelle">
            {q.libelle}
            {etoile}
          </span>
          {aide}
          <select value={valeur ?? ''} disabled={verrouille} onChange={val}>
            <option value="">Choisir…</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {err}
        </label>
      );
    }
    return (
      <fieldset class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
        <legend class="libelle">
          {q.libelle}
          {etoile}
        </legend>
        {aide}
        <div class="pilules">
          {options.map((o) => (
            <label key={o} class={coche(o) ? 'choisi' : ''}>
              <input type={multiple ? 'checkbox' : 'radio'} name={id} checked={coche(o)} disabled={verrouille} onChange={() => basculer(o)} />
              {o}
            </label>
          ))}
        </div>
        {err}
      </fieldset>
    );
  }
  const type = { date: 'date', nombre: 'number', telephone: 'tel', email: 'email' }[q.type] ?? 'text';
  const auto = { prenom: 'given-name', nom: 'family-name', email: 'email', tel: 'tel', dateNaissance: 'bday' }[q.id];
  return (
    <label class={`champ${erreur ? ' en-erreur' : ''}`} data-champ={q.id}>
      <span class="libelle">
        {q.libelle}
        {etoile}
      </span>
      {aide}
      {q.type === 'texte_long' ? (
        <textarea rows="3" value={valeur ?? ''} disabled={verrouille} onInput={val} />
      ) : (
        <input type={type} value={valeur ?? ''} disabled={verrouille} autocomplete={auto} onInput={val} />
      )}
      {err}
    </label>
  );
}

/** Zone où l'on signe avec le doigt (ou la souris). */
function Signature({ valeur, changer, nomParDefaut }) {
  const toile = useRef(null);
  const trace = useRef(false);
  const [signataire, setSignataire] = useState(valeur?.signataire ?? nomParDefaut);

  useEffect(() => {
    const c = toile.current;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (valeur?.image) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = valeur.image;
    }
  }, []);

  const point = (e) => {
    const r = toile.current.getBoundingClientRect();
    return [((e.clientX - r.left) * toile.current.width) / r.width, ((e.clientY - r.top) * toile.current.height) / r.height];
  };
  const debut = (e) => {
    e.preventDefault();
    toile.current.setPointerCapture?.(e.pointerId);
    const ctx = toile.current.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d2a4d';
    ctx.beginPath();
    ctx.moveTo(...point(e));
    trace.current = true;
  };
  const bouger = (e) => {
    if (!trace.current) return;
    const ctx = toile.current.getContext('2d');
    ctx.lineTo(...point(e));
    ctx.stroke();
  };
  const fin = () => {
    if (!trace.current) return;
    trace.current = false;
    changer({ image: toile.current.toDataURL('image/png'), signataire, le: new Date().toISOString() });
  };
  const effacer = () => {
    const c = toile.current;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    changer(null);
  };

  return (
    <div class="signature">
      <label>
        Nom de la personne qui signe
        <input
          value={signataire}
          onInput={(e) => {
            setSignataire(e.currentTarget.value);
            if (valeur?.image) changer({ ...valeur, signataire: e.currentTarget.value });
          }}
        />
      </label>
      <canvas
        ref={toile}
        width="600"
        height="200"
        aria-label="Zone de signature : signez avec le doigt ou la souris"
        onPointerDown={debut}
        onPointerMove={bouger}
        onPointerUp={fin}
        onPointerLeave={fin}
      />
      <div class="signature-pied">
        <span class="discret">{valeur?.image ? 'Signé ✓' : 'Signez dans le cadre avec le doigt.'}</span>
        <button type="button" class="lien-bouton" onClick={effacer}>
          Effacer
        </button>
      </div>
    </div>
  );
}
