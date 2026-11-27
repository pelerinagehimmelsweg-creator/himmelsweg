// « Inviter un ami » : une image d'invitation au nom du pèlerin (format story), à partager partout.
import qrcode from "qrcode-generator";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useAbonnement } from "../composants/base.jsx";
import logo from "../composants/logo.png";
import photoF from "../composants/invitation-f.jpg";
import photoH from "../composants/invitation-h.jpg";
import { joursAvant } from "../donnees/modele.js";
import { motInvitation } from "./soutien.jsx";
import { ALSACE } from "../composants/alsace.js";
import { CHEMIN, projection } from "../composants/accueil-invite.jsx";

const L = 1080;
const H = 1920;

/** Lien d'inscription qui garde la trace de qui invite. */
export function lienInvitation(session, mode) {
  const p = new URLSearchParams();
  if (mode === "demo") p.set("demo", "");
  p.set("invite", session.id);
  if (session.prenom) p.set("de", session.prenom);
  const base =
    mode === "demo"
      ? `${location.origin}/inscription`
      : "https://app.himmelsweg.fr/inscription";
  return `${base}?${p.toString().replace("demo=&", "demo&")}`;
}

export const messageInvitation = (prenom, lien) =>
  `${prenom ? `${prenom} vous invite` : "Je vous invite"} sur le chemin du Ciel 🙏\n` +
  `Les 7, 8 et 9 mai 2027, trois jours à pied de Scherwiller à Colmar avec le pèlerinage Himmelsweg.\n` +
  `Rejoignez-moi : ${lien}`;

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
  for (const para of texte.split("\n")) {
    let l = "";
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

/** Photos, blason et polices, chargés une fois par dessin ou par vidéo. */
export async function preparer({ groupe }) {
  await Promise.all([
    document.fonts.load("700 96px Cinzel"),
    document.fonts.load('400 42px "Source Sans 3 Variable"'),
    document.fonts.load('700 42px "Source Sans 3 Variable"'),
  ]);
  const [photo, blason] = await Promise.all([
    charger(groupe === "H" ? photoH : photoF),
    charger(logo),
  ]);
  return { photo, blason };
}

// Petite carte de l'Alsace (250 × 360), avec le chemin et la longueur des tracés pour les dessiner peu à peu.
const CARTE = (() => {
  const l = 250;
  const h = 360;
  const proj = projection(ALSACE, l, h, 6);
  const long = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
  const a = ALSACE.map(proj);
  const tr = CHEMIN.map(proj);
  const chemin = (pts) => `M${pts.map((p) => p.join(" ")).join(" L")}`;
  const P = typeof Path2D === "undefined" ? String : (d) => new Path2D(d);
  return { l, h, contour: P(`${chemin(a)} Z`), trace: P(chemin(tr)), longContour: long([...a, a[0]]), longTrace: long(tr), arrivee: tr.at(-1) };
})();

// Durée de l'animation (vidéo) ; à la fin, l'image est exactement l'image fixe.
export const DUREE_VIDEO = 7;
const doux = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
/** Avancement (0 → 1) d'un élément qui apparaît à « debut » pendant « duree » secondes. */
export const avance = (t, debut, duree = 0.7) => doux((t - debut) / duree);

/** Dessine l'invitation (1080 × 1920, format story Instagram et WhatsApp), à l'instant t de l'animation. */
export async function dessiner(canvas, opts, t = Infinity, res) {
  const { prenom, mot, lien, jours } = opts;
  const { photo, blason } = res ?? (await preparer(opts));
  canvas.width = L;
  canvas.height = H;
  const c = canvas.getContext("2d");
  const sans = (poids, taille) =>
    `${poids} ${taille}px "Source Sans 3 Variable", "Segoe UI", sans-serif`;
  const fixe = t === Infinity;
  /** Fait apparaître ce que dessine f : fondu et petite montée. */
  const apparait = (debut, f, duree = 0.7, monte = 40) => {
    const k = fixe ? 1 : avance(t, debut, duree);
    if (k <= 0) return;
    c.save();
    c.globalAlpha *= k;
    c.translate(0, (1 - k) * monte);
    f();
    c.restore();
  };

  // Photo en plein cadre (qui avance doucement dans la vidéo), assombrie vers le bas pour le texte.
  const zoom = fixe ? 1 : 1.14 - 0.14 * doux(t / DUREE_VIDEO);
  const r = Math.max(L / photo.width, H / photo.height) * zoom;
  c.drawImage(
    photo,
    (L - photo.width * r) / 2,
    (H - photo.height * r) / 2,
    photo.width * r,
    photo.height * r,
  );
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(35,28,24,.35)");
  g.addColorStop(0.18, "rgba(35,28,24,0)");
  g.addColorStop(0.4, "rgba(35,28,24,.05)");
  g.addColorStop(0.62, "rgba(35,28,24,.86)");
  g.addColorStop(1, "rgba(35,28,24,1)");
  c.fillStyle = g;
  c.fillRect(0, 0, L, H);

  // Carte de l'Alsace avec le chemin en rouge, en haut à droite.
  const kc = fixe ? 1 : avance(t, 0.5, 1.4);
  const kt = fixe ? 1 : avance(t, 1.7, 1.4);
  if (kc > 0) {
    const ox = L - 80 - CARTE.l;
    const oy = 290;
    c.save();
    c.translate(ox, oy);
    c.lineJoin = "round";
    c.lineCap = "round";
    c.shadowColor = "rgba(0,0,0,.35)";
    c.shadowBlur = 10;
    c.fillStyle = `rgba(255,253,248,${0.9 * (fixe ? 1 : doux((t - 1.2) / 0.6))})`;
    c.fill(CARTE.contour);
    c.shadowBlur = 0;
    c.strokeStyle = "#fffdf8";
    c.lineWidth = 3;
    c.setLineDash([CARTE.longContour * kc, CARTE.longContour]);
    c.stroke(CARTE.contour);
    if (kt > 0) {
      c.setLineDash([CARTE.longTrace * kt, CARTE.longTrace]);
      c.strokeStyle = "#b32d24";
      c.lineWidth = 7;
      c.stroke(CARTE.trace);
      c.setLineDash([]);
      if (kt >= 1) {
        const [x, y] = CARTE.arrivee;
        c.fillStyle = "#b32d24";
        c.beginPath();
        c.arc(x, y, 10, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  // En-tête : blason et nom, compte à rebours.
  apparait(0.2, () => {
    c.drawImage(blason, 80, 78, 92, 92);
    c.fillStyle = "#fff";
    c.font = "700 40px Cinzel";
    c.textBaseline = "middle";
    c.shadowColor = "rgba(0,0,0,.5)";
    c.shadowBlur = 12;
    c.fillText("HIMMELSWEG", 196, 126);
  }, 0.8, -30);
  if (jours > 0) {
    const k = fixe ? 1 : avance(t, 0.7, 0.5);
    if (k > 0) {
      c.save();
      c.font = "700 80px Cinzel";
      c.textBaseline = "middle";
      const txt = `J-${jours}`;
      const lt = Math.max(c.measureText(txt).width, 250) + 68;
      const cx = L - 80 - lt / 2;
      const echelle = fixe ? 1 : 0.6 + 0.4 * k + Math.sin(k * Math.PI) * 0.12;
      c.globalAlpha = k;
      c.translate(cx, 147);
      c.scale(echelle, echelle);
      c.translate(-cx, -147);
      c.fillStyle = "#b32d24";
      arrondi(c, L - 80 - lt, 70, lt, 154, 30);
      c.fill();
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.fillText(txt, cx, 128);
      c.font = sans(700, 24);
      c.fillText("AVANT LE DÉPART", cx, 190);
      c.restore();
    }
  }

  // Texte du bas, du bas vers le haut : QR code, mot du pèlerin, accroche.
  c.textBaseline = "alphabetic";
  const bas = H - 150;
  const cote = 200;
  const yQr = bas - cote - 40;
  apparait(4.2, () => {
    const qr = qrcode(0, "M");
    qr.addData(lien);
    qr.make();
    const n = qr.getModuleCount();
    c.fillStyle = "#fff";
    arrondi(c, 80, yQr - 20, cote + 40, cote + 40, 24);
    c.fill();
    c.fillStyle = "#231c18";
    const m = cote / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (qr.isDark(i, j))
          c.fillRect(100 + j * m, yQr + i * m, Math.ceil(m), Math.ceil(m));
  });
  apparait(4.5, () => {
    c.fillStyle = "#fff";
    c.font = sans(700, 44);
    c.fillText("Rejoignez-moi", 360, yQr + 70);
    c.fillStyle = "#fff";
    c.font = sans(400, 34);
    c.fillText("Scannez ou touchez le lien", 360, yQr + 122);
    c.fillText("Inscription en 5 minutes", 360, yQr + 168);
  });

  c.font = sans(400, 42);
  const texte = lignes(c, mot, L - 160);
  let y = yQr - 120 - (texte.length - 1) * 57;
  const yMot = y;
  apparait(3.2, () => {
    c.font = sans(400, 42);
    c.fillStyle = "#f6f1e4";
    texte.forEach((l, i) => c.fillText(l, 80, yMot + i * 57));
    if (prenom) {
      c.fillStyle = "#fff";
      c.font = sans(700, 42);
      c.fillText(`— ${prenom}`, 80, yMot + texte.length * 57 + 8);
    }
  }, 0.9);

  const titre = ["Trois jours.", "Un pèlerinage.", "Et vous ?"];
  y -= 80 + 104 * (titre.length - 1);
  // Taille ajustée pour que la plus longue ligne tienne dans la largeur.
  c.font = "700 96px Cinzel";
  const taille = Math.min(96, Math.floor((96 * (L - 160)) / Math.max(...titre.map((l) => c.measureText(l).width))));
  titre.forEach((l, i) => {
    apparait(1.1 + i * 0.55, () => {
      c.font = `700 ${taille}px Cinzel`;
      if (i === 2) {
        // « Et vous ? » en blanc sur un bandeau rouge du blason.
        const lt = c.measureText(l).width;
        c.fillStyle = "#b32d24";
        arrondi(c, 56, y + i * 104 - 84, lt + 48, 108, 14);
        c.fill();
      }
      c.fillStyle = "#fff";
      c.fillText(l, 80, y + i * 104);
    }, 0.8, 60);
  });
}

/** Joue l'animation une fois sur la toile (aperçu), puis laisse l'image fixe. */
export async function jouer(toile, opts, arret = { stop: false }) {
  const res = await preparer(opts);
  const calme = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (calme) return dessiner(toile, opts, Infinity, res);
  const debut = performance.now();
  await new Promise((ok) => {
    const image = () => {
      if (arret.stop) return ok();
      const t = (performance.now() - debut) / 1000;
      dessiner(toile, opts, t >= DUREE_VIDEO ? Infinity : t, res);
      if (t < DUREE_VIDEO) requestAnimationFrame(image);
      else ok();
    };
    requestAnimationFrame(image);
  });
}

/** Format vidéo que le téléphone sait enregistrer : MP4 de préférence (WhatsApp, Instagram), sinon rien. */
export function formatVideo() {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
  return ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"].find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

/** Joue l'animation sur la toile et l'enregistre en vidéo (DUREE_VIDEO secondes). */
export async function enregistrerVideo(toile, opts, surAvance) {
  const format = formatVideo();
  if (!format) throw new Error("Vidéo impossible sur ce téléphone");
  const res = await preparer(opts);
  await dessiner(toile, opts, 0, res);
  const flux = toile.captureStream(30);
  const rec = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 6_000_000 });
  const morceaux = [];
  rec.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
  const fin = new Promise((ok) => (rec.onstop = ok));
  rec.start(250);
  const debut = performance.now();
  await new Promise((ok) => {
    const image = async () => {
      const t = (performance.now() - debut) / 1000;
      await dessiner(toile, opts, Math.min(t, DUREE_VIDEO), res);
      surAvance?.(Math.min(1, t / (DUREE_VIDEO + 1)));
      // Une seconde de plus sur l'image finale, pour lire le QR code.
      if (t < DUREE_VIDEO + 1) requestAnimationFrame(image);
      else ok();
    };
    requestAnimationFrame(image);
  });
  rec.stop();
  await fin;
  flux.getTracks().forEach((p) => p.stop());
  return new File([new Blob(morceaux, { type: "video/mp4" })], "invitation-himmelsweg.mp4", { type: "video/mp4" });
}

export function Inviter({ donnees, session }) {
  const canvas = useRef(null);
  const admin = !!session.estAdmin;
  const config = useAbonnement(
    (cb) => donnees.ecouterConfigApp(cb),
    [donnees],
    null,
  );
  const [groupeApercu, setGroupeApercu] = useState("F");
  const groupe = admin ? groupeApercu : session.groupe;
  const prenom = admin ? "Prénom" : session.prenom;
  const mot = config ? motInvitation(config, groupe) : null;
  const [pret, setPret] = useState(false);
  const [msg, setMsg] = useState("");
  const lien = lienInvitation(session, donnees.mode);
  const message = messageInvitation(session.prenom, lien);
  const amis = Number(session.amisInscrits) || 0;

  const opts = { groupe, prenom, mot, lien, jours: joursAvant() };
  const [video, setVideo] = useState(null); // null, ou avancement de l'enregistrement (0 → 1)
  const peutVideo = useMemo(() => !admin && !!formatVideo(), [admin]);

  useEffect(() => {
    if (mot === null) return;
    setPret(false);
    const arret = { stop: false };
    jouer(canvas.current, opts, arret)
      .then(() => !arret.stop && setPret(true))
      .catch(() => setMsg("L’image n’a pas pu être préparée."));
    return () => (arret.stop = true);
  }, [mot, groupe]);

  // Deux temps : on prépare la vidéo (8 s), puis on la partage d'une nouvelle touche
  // (les téléphones n'ouvrent le partage que juste après qu'on a touché l'écran).
  const [fichierVideo, setFichierVideo] = useState(null);
  const preparerVideo = async () => {
    setMsg("");
    setPret(false);
    setVideo(0);
    try {
      setFichierVideo(await enregistrerVideo(canvas.current, opts, setVideo));
      setMsg("La vidéo est prête ✓ Touchez « Partager la vidéo ».");
    } catch {
      setMsg("La vidéo n’a pas pu être préparée. Partagez plutôt l’image.");
    }
    await dessiner(canvas.current, opts).catch(() => {});
    setVideo(null);
    setPret(true);
  };
  const partagerVideo = async () => {
    setMsg("");
    const f = fichierVideo;
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], text: message });
      } catch {
        // partage annulé
      }
    } else {
      telecharger(f, "invitation-himmelsweg.mp4");
      setMsg("Votre téléphone ne permet pas de partager la vidéo directement : elle a été enregistrée. Ajoutez-la à votre message.");
    }
  };

  const fichier = () =>
    new Promise((ok) =>
      canvas.current.toBlob(
        (b) =>
          ok(
            new File([b], "invitation-himmelsweg.jpg", { type: "image/jpeg" }),
          ),
        "image/jpeg",
        0.9,
      ),
    );
  const partager = async () => {
    setMsg("");
    const f = await fichier();
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], text: message });
      } catch {
        // partage annulé
      }
    } else {
      telecharger(f);
      setMsg(
        "Votre téléphone ne permet pas de partager l’image directement : elle a été enregistrée. Ajoutez-la à votre message.",
      );
    }
  };
  const telecharger = async (f, nom = "invitation-himmelsweg.jpg") => {
    const url = URL.createObjectURL(f instanceof File ? f : await fichier());
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: nom,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setMsg("Lien copié.");
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
          🎉 {amis} {amis > 1 ? "amis inscrits" : "ami inscrit"} grâce à vous.
          Merci !
        </p>
      )}
      <p class="discret">
        {admin
          ? "Aperçu de l’image que les pèlerins partagent, avec leur prénom et leur propre QR code."
          : "Voici votre invitation personnelle. Le QR code et le lien mènent à l’inscription."}
      </p>
      <div class="invitation">
        <canvas
          ref={canvas}
          width={L}
          height={H}
          aria-label="Image d’invitation"
        />
      </div>
      {admin && (
        <div class="actions">
          <button
            type="button"
            class={`bouton petit ${groupe === "F" ? "" : "secondaire"}`}
            onClick={() => setGroupeApercu("F")}
          >
            Pèlerines
          </button>
          <button
            type="button"
            class={`bouton petit ${groupe === "H" ? "" : "secondaire"}`}
            onClick={() => setGroupeApercu("H")}
          >
            Pèlerins
          </button>
          <a class="lien-bouton" href="#/moi">
            Modifier le mot
          </a>
        </div>
      )}
      {!admin && (
        <div class="partage">
          {peutVideo && (
            <button
              type="button"
              class="bouton large"
              disabled={!pret}
              onClick={fichierVideo ? partagerVideo : preparerVideo}
            >
              {video !== null
                ? `Préparation de la vidéo… ${Math.round(video * 100)} %`
                : fichierVideo
                  ? "▶ Partager la vidéo"
                  : "▶ Créer ma vidéo"}
            </button>
          )}
          <button
            type="button"
            class={`bouton large${peutVideo ? " secondaire" : ""}`}
            disabled={!pret}
            onClick={partager}
          >
            Partager l’image
          </button>
          <div class="partage-liens">
            <a
              class="bouton secondaire"
              href={`https://wa.me/?text=${texte}`}
              target="_blank"
              rel="noopener"
            >
              WhatsApp
            </a>
            <a class="bouton secondaire" href={`sms:?&body=${texte}`}>
              SMS
            </a>
            <a
              class="bouton secondaire"
              href={`mailto:?subject=${encodeURIComponent("Venez marcher avec moi vers le Ciel")}&body=${texte}`}
            >
              E-mail
            </a>
          </div>
          <div class="actions">
            <button
              type="button"
              class="lien-bouton"
              disabled={!pret}
              onClick={() => telecharger()}
            >
              Enregistrer l’image
            </button>
            <button type="button" class="lien-bouton" onClick={copier}>
              Copier le lien
            </button>
          </div>
        </div>
      )}
      {msg && <p class="info">{msg}</p>}
      {!admin && (
        <p class="discret petit-texte">
          {peutVideo && "La vidéo (8 secondes) est parfaite pour les statuts WhatsApp et les stories. "}
          « Partager l’image » ouvre WhatsApp, Instagram, Messages ou les
          e-mails avec l’image et le texte. Les boutons WhatsApp, SMS et E-mail
          envoient le texte et le lien seuls.
        </p>
      )}
    </>
  );
}
