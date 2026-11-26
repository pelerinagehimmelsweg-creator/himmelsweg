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
    avant: 'M4 6h16M4 12h16M4 18h10',
    pendant: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    apres: 'M12 20.5l-1.4-1.3C5.4 14.5 2 11.4 2 7.6 2 4.5 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.5 22 7.6c0 3.8-3.4 6.9-8.6 11.6z',
    pelerins: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
    moi: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 10a8 8 0 0 1 16 0',
  }[nom];
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d={d} />
    </svg>
  );
}
