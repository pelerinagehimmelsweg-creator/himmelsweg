// Reçoit les notifications de l'app quand elle est fermée (Firebase Cloud Messaging).
// La configuration ci-dessous est publique (la même que dans l'app).
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAr-mO39_gnd3-nzPpzyqXD7ns5xpruWtA',
  authDomain: 'himmelsweg-cbd26.firebaseapp.com',
  projectId: 'himmelsweg-cbd26',
  appId: '1:6299518098:web:85fabbe6b32e956f10124b',
  messagingSenderId: '6299518098',
});

// Les messages arrivent avec leur titre et leur texte : Firebase les affiche tout seul.
firebase.messaging();
