/*
 * Terminal 3: cd demo-attacked/mass-assignment && npm run victim-protected
 */

const { createProfileHubApp } = require('./profilehub-app');

createProfileHubApp({
  port: 3048,
  protected: true,
  label: 'ProfileHub (protected)',
});
