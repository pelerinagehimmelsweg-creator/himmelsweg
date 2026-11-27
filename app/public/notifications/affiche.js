// Affiche d'une notification : la photo du modèle avec le titre écrit en lettres dorées.
// Dessinée dans le téléphone au moment où la notification arrive (aucun serveur d'images),
// par le service worker (firebase-messaging-sw.js) et par l'app (bannière, aperçu des admins).
// En cas d'échec, on garde la photo simple du modèle (/notifications/<modele>.jpg).
(function () {
  const L = 1024;
  const H = 512;
  const OR = ['#fff3c4', '#f3d77a', '#c9962e'];
  const adresse = (chemin) => (self.location && self.location.origin ? self.location.origin + chemin : chemin);

  /** Titre sans emoji (la police n'en a pas) ni espaces en trop. */
  function titreAffiche(titre) {
    return String(titre || '')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Coupe le titre en 2 lignes au plus, en réduisant la taille si besoin. mesure(texte, taille) → largeur. */
  function couper(titre, mesure, largeurMax) {
    const mots = titre.split(' ');
    const lignesPour = (taille) => {
      const lignes = [];
      let ligne = '';
      for (const mot of mots) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (!ligne || mesure(essai, taille) <= largeurMax) ligne = essai;
        else {
          lignes.push(ligne);
          ligne = mot;
        }
      }
      if (ligne) lignes.push(ligne);
      return lignes;
    };
    for (let taille = 68; taille >= 34; taille -= 2) {
      const lignes = lignesPour(taille);
      if (lignes.length === 1 && mesure(lignes[0], taille) <= largeurMax) return { taille, lignes };
      if (lignes.length === 2) {
        // Deux lignes équilibrées plutôt qu'une pleine et un bout.
        let mieux = null;
        for (let i = 1; i < mots.length; i++) {
          const deux = [mots.slice(0, i).join(' '), mots.slice(i).join(' ')];
          const large = Math.max(...deux.map((l) => mesure(l, taille)));
          if (large <= largeurMax && (!mieux || large < mieux.large)) mieux = { large, deux };
        }
        if (mieux) return { taille, lignes: mieux.deux };
      }
    }
    // Trop long : deux lignes, la seconde raccourcie avec « … ».
    const taille = 34;
    const lignes = lignesPour(taille);
    const deux = lignes.slice(0, 2).map((l, i) => {
      let fin = l;
      const coupe = (i === 1 && lignes.length > 2) || mesure(l, taille) > largeurMax;
      if (!coupe) return l;
      while (fin && mesure(`${fin}…`, taille) > largeurMax) fin = fin.slice(0, -1);
      return `${fin.trim()}…`;
    });
    return { taille, lignes: deux };
  }

  let police = null;
  function chargerPolice() {
    if (!police) {
      const f = new FontFace('CinzelAffiche', `url(${adresse('/notifications/cinzel-700.woff2')})`, { weight: '700' });
      police = f
        .load()
        .then((p) => {
          (self.fonts || self.document?.fonts)?.add(p);
          return 'CinzelAffiche';
        })
        .catch(() => 'Georgia, serif');
    }
    return police;
  }

  async function bitmap(url) {
    const r = await fetch(adresse(url), { cache: 'force-cache' });
    if (!r.ok) throw new Error(url);
    return createImageBitmap(await r.blob());
  }

  /** Dessine l'affiche et rend une image JPEG (Blob). */
  async function dessinerAffiche(modele, titre) {
    const texte = titreAffiche(titre);
    const [famille, fond, blason] = await Promise.all([
      chargerPolice(),
      bitmap(`/notifications/fond-${modele}.jpg`),
      bitmap('/notifications/blason.png').catch(() => null),
    ]);
    const toile = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(L, H) : Object.assign(document.createElement('canvas'), { width: L, height: H });
    const c = toile.getContext('2d');
    c.drawImage(fond, 0, 0, L, H);

    // Blason et nom, en haut à gauche.
    if (blason) c.drawImage(blason, 46, 40, 52, 52);
    c.font = `700 24px ${famille}`;
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(0,0,0,.55)';
    c.shadowBlur = 8;
    c.letterSpacing = '4px';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText('HIMMELSWEG', blason ? 112 : 50, 67);
    c.letterSpacing = '0px';

    if (texte) {
      const mesure = (t, taille) => {
        c.font = `700 ${taille}px ${famille}`;
        return c.measureText(t).width;
      };
      const { taille, lignes } = couper(texte, mesure, L - 180);
      const interligne = taille * 1.18;
      const bas = H - 92;
      const haut = bas - interligne * (lignes.length - 1);
      c.font = `700 ${taille}px ${famille}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      lignes.forEach((ligne, i) => {
        const y = haut + i * interligne;
        const degrade = c.createLinearGradient(0, y - taille * 0.8, 0, y + taille * 0.1);
        OR.forEach((couleur, k) => degrade.addColorStop(k / (OR.length - 1), couleur));
        c.shadowColor = 'rgba(0,0,0,.7)';
        c.shadowBlur = 14;
        c.shadowOffsetY = 3;
        c.fillStyle = degrade;
        c.fillText(ligne, L / 2, y);
        c.shadowColor = 'transparent';
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(110,70,10,.35)';
        c.strokeText(ligne, L / 2, y);
      });

      // Petit filet doré sous le titre, avec un losange au milieu.
      const y = bas + 30;
      c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(243,215,122,.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(L / 2 - 120, y);
      c.lineTo(L / 2 - 14, y);
      c.moveTo(L / 2 + 14, y);
      c.lineTo(L / 2 + 120, y);
      c.stroke();
      c.fillStyle = '#f3d77a';
      c.beginPath();
      c.moveTo(L / 2, y - 7);
      c.lineTo(L / 2 + 7, y);
      c.lineTo(L / 2, y + 7);
      c.lineTo(L / 2 - 7, y);
      c.closePath();
      c.fill();
    }

    if (toile.convertToBlob) return toile.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    return new Promise((ok) => toile.toBlob(ok, 'image/jpeg', 0.86));
  }

  self.AFFICHE_NOTIFICATION = { dessinerAffiche, titreAffiche, couper };
})();
