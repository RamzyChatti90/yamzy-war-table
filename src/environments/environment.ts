export const environment = {
  production: false,
  /** Base URL des appels /api — relative = passe par le proxy nginx vers Yamzy backend */
  apiUrl: '/api',
  /** URL de l'instance Yamzy hôte (sert au bridge SSO + check connectivité)
   *  En prod : changer pour 'https://yamzy.world' */
  yamzyHostUrl: 'http://localhost:4200',
  /** Mode standalone (true) = pas de bridge SSO local, l'extension marche seule
   *  avec une connexion directe à la prod Yamzy déployée. */
  standaloneMode: false,
  appName: 'WAR TABLE',
};
