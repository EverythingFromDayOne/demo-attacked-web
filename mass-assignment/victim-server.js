/*
 * Terminal 1: cd demo-attacked/mass-assignment && npm install && npm run victim
 * Attack guide: npm run attacker → http://localhost:3047
 */

const { createProfileHubApp } = require('./profilehub-app');

createProfileHubApp({
  port: 3046,
  protected: false,
  label: 'ProfileHub (vulnerable)',
});
