import { useEffect, useState } from 'preact/hooks';
import { enLignes, morceaux } from '../donnees/modele.js';

export function Texte({ texte }) {
  return (
    <div class="texte">
      {enLignes(texte).map((b, i) =>
        b.type === 'liste' ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Ligne texte={it} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Ligne texte={b.texte} />
          </p>
        ),
      )}
    </div>
  );
}

function Ligne({ texte }) {
  return morceaux(texte).map((m, i) =>
    m.lien ? (
      <a key={i} href={m.lien} target={m.lien.startsWith('http') ? '_blank' : undefined} rel="noopener">
        {m.t}
      </a>
    ) : m.gras ? (
      <strong key={i}>{m.t}</strong>
    ) : m.ital ? (
      <em key={i}>{m.t}</em>
    ) : (
      m.t
    ),
  );
}

export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    addEventListener('online', maj);
    addEventListener('offline', maj);
    return () => {
      removeEventListener('online', maj);
      removeEventListener('offline', maj);
    };
  }, []);
  return enLigne;
}

/** Abonnement à une source de données ; se réabonne quand `deps` change. */
export function useAbonnement(abonner, deps, initial) {
  const [val, setVal] = useState(initial);
  useEffect(() => {
    setVal(initial);
    return abonner(setVal);
  }, deps);
  return val;
}

export function Icone({ nom }) {
  const d = {
    accueil: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
    infos: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.01',
    prier: 'M12 3v18M7 8h10M5 21h14',
    pelerins: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
    moi: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 10a8 8 0 0 1 16 0',
    equipe: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 12h16',
  }[nom];
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d={d} />
    </svg>
  );
}
