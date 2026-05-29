// Template d'environnement public — copier en environment.ts pour la prod.
// Le fichier réel environment.ts est versionné MAIS sans secret (apiUrl relatif via proxy).
// Pour pointer vers une instance Yamzy déployée : copier en environment.local.ts (gitignored).

export const environment = {
  production: false,
  /** Base URL des appels /api — relative = passe par le proxy nginx vers Yamzy backend */
  apiUrl: '/api',
  /** URL de l'instance Yamzy hôte (sert au bridge SSO + check connectivité) */
  yamzyHostUrl: 'http://localhost:4200',
  /** Mode standalone (true) = pas de bridge SSO, l'extension marche seule avec son propre auth */
  standaloneMode: false,
  appName: 'WAR TABLE',
};
