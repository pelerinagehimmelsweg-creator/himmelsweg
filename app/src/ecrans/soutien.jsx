// Boutique et don (pages HelloAsso), sur l'accueil et dans Moi. Liens modifiables par les admins.
import { useEffect, useState } from "preact/hooks";
import { useAbonnement, useEnLigne } from "../composants/base.jsx";
import { LIENS } from "../donnees/modele.js";

const lien = (config, k) => (config?.[k] || "").trim() || LIENS[k];

/**
 * forme : 'discret' (avant et pendant le pèlerinage), 'merci' (après : le don bien en avant), 'moi'.
 */
export function Soutien({ donnees, forme = "discret" }) {
  if (forme === "merci") {
    return (
      <section class="carte soutien-merci">
        <h2>Soutenir le pèlerinage</h2>
        <p>
          Himmelsweg vit grâce à la générosité de chacun. Votre don aide à
          préparer le prochain pèlerinage.
        </p>
        <div class="actions">
          <a class="bouton" href="#/don">
            Faire un don
          </a>
          <a class="bouton secondaire" href="#/boutique">
            Boutique
          </a>
        </div>
        <p class="discret petit-texte">Paiement sécurisé sur HelloAsso.</p>
      </section>
    );
  }
  return (
    <section class="carte">
      <h2>
        {forme === "moi" ? "Soutenir le pèlerinage" : "Boutique du pèlerinage"}
      </h2>
      {forme !== "moi" && (
        <p class="discret">
          Souvenirs et options du pèlerinage, sur HelloAsso.
        </p>
      )}
      <div class="actions">
        <a class="bouton" href="#/boutique">
          {forme === "moi" ? "Boutique" : "Voir la boutique"}
        </a>
        <a
          class={forme === "moi" ? "bouton secondaire" : "lien-bouton"}
          href="#/don"
        >
          Faire un don
        </a>
      </div>
    </section>
  );
}

/** Boutique ou don HelloAsso, affichés dans l'app (module « widget » de HelloAsso). */
export function PageHelloAsso({ donnees, quoi }) {
  const config = useAbonnement(
    (cb) => donnees.ecouterConfigApp(cb),
    [donnees],
    {},
  );
  const enLigne = useEnLigne();
  const [hauteur, setHauteur] = useState(quoi === "don" ? 1000 : 1100);
  const page = lien(config, quoi)
    .replace(/\/widget\/?$/, "")
    .replace(/\/+$/, "");
  // HelloAsso envoie la hauteur de son contenu : l'encadré s'ajuste, sans double barre de défilement.
  useEffect(() => {
    const recevoir = (e) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*helloasso\.com$/.test(e.origin)) return;
      const h = Number(e.data?.height);
      if (h > 200) setHauteur(h + 20);
    };
    addEventListener("message", recevoir);
    return () => removeEventListener("message", recevoir);
  }, []);
  return (
    <>
      <a class="lien-retour" href="#/">
        ‹ Accueil
      </a>
      <h1>{quoi === "don" ? "Faire un don" : "Boutique"}</h1>
      {enLigne ? (
        <iframe
          class="helloasso"
          src={`${page}/widget`}
          title={quoi === "don" ? "Faire un don" : "Boutique Himmelsweg"}
          style={{ height: `${hauteur}px` }}
          allow="payment"
        />
      ) : (
        <p class="encart">
          Il faut du réseau pour ouvrir{" "}
          {quoi === "don" ? "le don" : "la boutique"}. Réessayez quand vous êtes
          connecté.
        </p>
      )}
      <p class="discret petit-texte">
        Paiement sécurisé par HelloAsso.{" "}
        <a href={page} target="_blank" rel="noopener">
          Ouvrir sur le site HelloAsso
        </a>
      </p>
    </>
  );
}

/** Réglage des deux liens, pour les admins (dans Moi). */
export function ReglageSoutien({ donnees }) {
  const config = useAbonnement(
    (cb) => donnees.ecouterConfigApp(cb),
    [donnees],
    null,
  );
  const [v, setV] = useState({});
  const [msg, setMsg] = useState("");
  if (!config) return null;
  const val = (k) => v[k] ?? config[k] ?? "";
  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await donnees.enregistrerConfigApp({
        ...config,
        boutique: val("boutique").trim(),
        don: val("don").trim(),
      });
      setMsg("Enregistré.");
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <form class="carte formulaire" onSubmit={enregistrer}>
      <h2>Boutique et don</h2>
      <p class="discret">
        Adresses des pages HelloAsso ouvertes par les boutons « Boutique » et «
        Faire un don ». Laissez vide pour la page habituelle.
      </p>
      <label>
        Boutique
        <input
          type="url"
          value={val("boutique")}
          placeholder={LIENS.boutique}
          onInput={(e) => setV({ ...v, boutique: e.currentTarget.value })}
        />
      </label>
      <label>
        Don
        <input
          type="url"
          value={val("don")}
          placeholder={LIENS.don}
          onInput={(e) => setV({ ...v, don: e.currentTarget.value })}
        />
      </label>
      <div class="actions">
        <button class="bouton petit">Enregistrer</button>
        {msg && <span class="discret">{msg}</span>}
      </div>
    </form>
  );
}

/** Mot de l'invitation, choisi par les admins (un texte pour les pèlerines, un pour les pèlerins). */
export const motInvitation = (config, groupe) =>
  (groupe === "H" ? config?.motInvitationH : config?.motInvitationF)?.trim() ||
  `Les 7, 8 et 9 mai 2027, je pars à pied sur le chemin du Ciel, de Scherwiller à Colmar. Je serais ${groupe === "H" ? "heureux" : "heureuse"} que vous veniez.`;

export function ReglageInvitation({ donnees }) {
  const config = useAbonnement(
    (cb) => donnees.ecouterConfigApp(cb),
    [donnees],
    null,
  );
  const [v, setV] = useState({});
  const [msg, setMsg] = useState("");
  if (!config) return null;
  const val = (k) => v[k] ?? config[k] ?? "";
  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      await donnees.enregistrerConfigApp({
        ...config,
        motInvitationF: val("motInvitationF").trim(),
        motInvitationH: val("motInvitationH").trim(),
      });
      setMsg("Enregistré.");
    } catch (err) {
      setMsg(err.message);
    }
  };
  const champ = (k, titre, groupe) => (
    <label>
      {titre}
      <textarea
        rows="3"
        maxLength={200}
        value={val(k)}
        placeholder={motInvitation({}, groupe)}
        onInput={(e) => setV({ ...v, [k]: e.currentTarget.value })}
      />
    </label>
  );
  return (
    <form class="carte formulaire" onSubmit={enregistrer}>
      <h2>Invitation d’un ami</h2>
      <p class="discret">
        Le mot écrit sur l’image que les pèlerins partagent. Ils ne peuvent pas
        le modifier. Laissez vide pour le texte habituel.
      </p>
      {champ("motInvitationF", "Mot des pèlerines", "F")}
      {champ("motInvitationH", "Mot des pèlerins", "H")}
      <div class="actions">
        <button class="bouton petit">Enregistrer</button>
        <a class="lien-bouton" href="#/inviter">
          Voir l’image
        </a>
        {msg && <span class="discret">{msg}</span>}
      </div>
    </form>
  );
}

/** Petite carte « Invitez un ami » (accueil et Moi). */
export function CarteInviter({ session }) {
  const amis = Number(session.amisInscrits) || 0;
  return (
    <a class="carte carte-inviter" href="#/inviter">
      <span>
        <strong>Invitez un ami</strong>
        <small>
          {amis > 0
            ? `${amis} ${amis > 1 ? "amis inscrits" : "ami inscrit"} grâce à vous`
            : "Une invitation à votre nom, à partager en un geste"}
        </small>
      </span>
      <span class="bouton petit">Inviter</span>
    </a>
  );
}
