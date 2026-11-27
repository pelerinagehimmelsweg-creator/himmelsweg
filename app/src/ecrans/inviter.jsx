// « Inviter un ami » : une image d'invitation au nom du pèlerin (format story), à partager partout.
import qrcode from 'qrcode-generator';
import { useEffect, useRef, useState } from 'preact/hooks';
import logo from '../composants/logo.png';
import photoF from '../composants/invitation-f.jpg';
import photoH from '../composants/invitation-h.jpg';
import { joursAvant } from '../donnees/modele.js';

const L = 1080;
const H = 1920;

/** Lien d'inscription qui garde la trace de qui invite. */
export function lienInvitation(session, mode) {
  const p = new URLSearchParams();
  if (mode === 'demo') p.set('demo', '');
  p.set('invite', session.id);
  if (session.prenom) p.set('de', session.prenom);
  const base = mode === 'demo' ? `${location.origin}/inscription` : 'https://app.himmelsweg.fr/inscription';
  return `${base}?${p.toString().replace('demo=&', 'demo&')}`;
}

export const messageInvitation = (prenom, lien) =>
  `${prenom ? `${prenom} t’invite` : 'Je t’invite'} sur le chemin du Ciel 🙏\n` +
  `Les 7, 8 et 9 mai 2027, trois jours à pied de Scherwiller à Colmar avec le pèlerinage Himmelsweg.\n` +
  `Rejoins-moi : ${lien}`;

const charger = (src) =>
  new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = src;
  });

/** Coupe un texte en lignes qui tiennent dans la largeur. */
function lignes(ctx, texte, largeur) {
  const res = [];
  for (const para of texte.split('\n')) {
    let l = '';
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      const essai = l ? `${l} ${mot}` : mot;
      if (ctx.measureText(essai).width > largeur && l) {
        res.push(l);
        l = mot;
      } else l = essai;
    }
    res.push(l);
  }
  return res;
}

function arrondi(ctx, x, y, l, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/** Dessine l'invitation (1080 × 1920, format story Instagram et WhatsApp). */
export async function dessiner(canvas, { groupe, prenom, mot, lien, jours }) {
  await Promise.all([document.fonts.load('700 96px Cinzel'), document.fonts.load('400 42px "Source Sans 3 Variable"'), document.fonts.load('700 42px "Source Sans 3 Variable"')]);
  const [photo, blason] = await Promise.all([charger(groupe === 'H' ? photoH : photoF), charger(logo)]);
  canvas.width = L;
  canvas.height = H;
  const c = canvas.getContext('2d');
  const sans = (poids, taille) => `${poids} ${taille}px "Source Sans 3 Variable", "Segoe UI", sans-serif`;

  // Photo en plein cadre, assombrie vers le bas pour le texte.
  const r = Math.max(L / photo.width, H / photo.height);
  c.drawImage(photo, (L - photo.width * r) / 2, (H - photo.height * r) / 2, photo.width * r, photo.height * r);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(35,28,24,.35)');
  g.addColorStop(0.18, 'rgba(35,28,24,0)');
  g.addColorStop(0.4, 'rgba(35,28,24,.05)');
  g.addColorStop(0.62, 'rgba(35,28,24,.86)');
  g.addColorStop(1, 'rgba(35,28,24,1)');
  c.fillStyle = g;
  c.fillRect(0, 0, L, H);

  // En-tête : blason et nom, compte à rebours.
  c.drawImage(blason, 80, 78, 92, 92);
  c.fillStyle = '#fff';
  c.font = '700 40px Cinzel';
  c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,0,0,.5)';
  c.shadowBlur = 12;
  c.fillText('HIMMELSWEG', 196, 126);
  c.shadowBlur = 0;
  if (jours > 0) {
    c.font = '700 80px Cinzel';
    const t = `J-${jours}`;
    const lt = Math.max(c.measureText(t).width, 250) + 68;
    c.fillStyle = '#b32d24';
    arrondi(c, L - 80 - lt, 70, lt, 154, 30);
    c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.fillText(t, L - 80 - lt / 2, 128);
    c.font = sans(700, 24);
    c.fillText('AVANT LE DÉPART', L - 80 - lt / 2, 190);
    c.textAlign = 'left';
  }

  // Texte du bas, du bas vers le haut : QR code, mot du pèlerin, accroche.
  c.textBaseline = 'alphabetic';
  const bas = H - 150;
  const qr = qrcode(0, 'M');
  qr.addData(lien);
  qr.make();
  const n = qr.getModuleCount();
  const cote = 200;
  const yQr = bas - cote - 40;
  c.fillStyle = '#fff';
  arrondi(c, 80, yQr - 20, cote + 40, cote + 40, 24);
  c.fill();
  c.fillStyle = '#231c18';
  const m = cote / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (qr.isDark(i, j)) c.fillRect(100 + j * m, yQr + i * m, Math.ceil(m), Math.ceil(m));
  c.fillStyle = '#f3d77a';
  c.font = sans(700, 44);
  c.fillText('Rejoins-moi', 360, yQr + 70);
  c.fillStyle = '#fff';
  c.font = sans(400, 34);
  c.fillText('Scanne ou touche le lien', 360, yQr + 122);
  c.fillText('Inscription en 5 minutes', 360, yQr + 168);

  c.font = sans(400, 42);
  const texte = lignes(c, mot, L - 160);
  let y = yQr - 120 - (texte.length - 1) * 57;
  c.fillStyle = '#f6f1e4';
  texte.forEach((l, i) => c.fillText(l, 80, y + i * 57));
  if (prenom) {
    c.fillStyle = '#fff';
    c.font = sans(700, 42);
    c.fillText(`— ${prenom}`, 80, y + texte.length * 57 + 8);
  }

  c.font = '700 96px Cinzel';
  const titre = ['Trois jours.', 'Un chemin.', 'Et toi ?'];
  y -= 80 + 104 * (titre.length - 1);
  titre.forEach((l, i) => {
    c.fillStyle = i === 2 ? '#f3d77a' : '#fff';
    c.fillText(l, 80, y + i * 104);
  });
}

export function Inviter({ donnees, session }) {
  const canvas = useRef(null);
  const F = session.groupe === 'F';
  const motDepart = `Les 7, 8 et 9 mai 2027, je pars à pied sur le chemin du Ciel, de Scherwiller à Colmar. Je serais ${F ? 'heureuse' : 'heureux'} que tu viennes.`;
  const [mot, setMot] = useState(motDepart);
  const [pret, setPret] = useState(false);
  const [msg, setMsg] = useState('');
  const lien = lienInvitation(session, donnees.mode);
  const message = messageInvitation(session.prenom, lien);
  const amis = Number(session.amisInscrits) || 0;

  useEffect(() => {
    const t = setTimeout(() => {
      dessiner(canvas.current, { groupe: session.groupe, prenom: session.prenom, mot, lien, jours: joursAvant() })
        .then(() => setPret(true))
        .catch(() => setMsg('L’image n’a pas pu être préparée.'));
    }, 250);
    return () => clearTimeout(t);
  }, [mot]);

  const fichier = () =>
    new Promise((ok) => canvas.current.toBlob((b) => ok(new File([b], 'invitation-himmelsweg.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9));
  const partager = async () => {
    setMsg('');
    const f = await fichier();
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], text: message });
      } catch {
        // partage annulé
      }
    } else {
      telecharger(f);
      setMsg('Votre téléphone ne permet pas de partager l’image directement : elle a été enregistrée. Ajoutez-la à votre message.');
    }
  };
  const telecharger = async (f) => {
    const url = URL.createObjectURL(f instanceof File ? f : await fichier());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'invitation-himmelsweg.jpg' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setMsg('Lien copié.');
    } catch {
      setMsg(lien);
    }
  };
  const texte = encodeURIComponent(message);

  return (
    <>
      <a class="lien-retour" href="#/">
        ‹ Accueil
      </a>
      <h1>Inviter un ami</h1>
      {amis > 0 && (
        <p class="info">
          🎉 {amis} {amis > 1 ? 'amis inscrits' : 'ami inscrit'} grâce à vous. Merci !
        </p>
      )}
      <p class="discret">Voici votre invitation personnelle. Le QR code et le lien mènent à l’inscription.</p>
      <div class="invitation">
        <canvas ref={canvas} width={L} height={H} aria-label="Image d’invitation" />
      </div>
      <label class="formulaire">
        Votre mot
        <textarea rows="3" maxLength={200} value={mot} onInput={(e) => setMot(e.currentTarget.value)} />
      </label>

      <div class="partage">
        <button type="button" class="bouton large" disabled={!pret} onClick={partager}>
          Partager l’image
        </button>
        <div class="partage-liens">
          <a class="bouton secondaire" href={`https://wa.me/?text=${texte}`} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a class="bouton secondaire" href={`sms:?&body=${texte}`}>
            SMS
          </a>
          <a class="bouton secondaire" href={`mailto:?subject=${encodeURIComponent('Viens marcher avec moi vers le Ciel')}&body=${texte}`}>
            E-mail
          </a>
        </div>
        <div class="actions">
          <button type="button" class="lien-bouton" disabled={!pret} onClick={() => telecharger()}>
            Enregistrer l’image
          </button>
          <button type="button" class="lien-bouton" onClick={copier}>
            Copier le lien
          </button>
        </div>
      </div>
      {msg && <p class="info">{msg}</p>}
      <p class="discret petit-texte">
        « Partager l’image » ouvre WhatsApp, Instagram, Messages ou les e-mails avec l’image et le texte. Les boutons WhatsApp, SMS et E-mail
        envoient le texte et le lien seuls.
      </p>
    </>
  );
}

