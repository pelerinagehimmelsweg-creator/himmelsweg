import '@fontsource/cinzel/700.css';
import '@fontsource-variable/source-sans-3';
import { render } from 'preact';
import { App } from './app.jsx';
import { chargerDonnees } from './donnees/index.js';
import { Inscription } from './ecrans/inscription.jsx';
import './styles.css';

// app.himmelsweg.fr/inscription : formulaire public, sans connexion.
const publique = location.pathname.startsWith('/inscription');

chargerDonnees().then((donnees) =>
  render(publique ? <Inscription donnees={donnees} /> : <App donnees={donnees} />, document.getElementById('app')),
);
