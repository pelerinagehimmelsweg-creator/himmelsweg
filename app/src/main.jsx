import '@fontsource/cinzel/700.css';
import '@fontsource-variable/source-sans-3';
import { render } from 'preact';
import { App } from './app.jsx';
import { chargerDonnees } from './donnees/index.js';
import './styles.css';

chargerDonnees().then((donnees) => render(<App donnees={donnees} />, document.getElementById('app')));
