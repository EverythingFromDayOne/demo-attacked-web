/*
 * Terminal 3: cd demo-attacked/path-traversal && npm run secure
 */

const { createFileVaultApp } = require('./filevault-app');

createFileVaultApp({
  port: 3045,
  protected: true,
  label: 'FileVault (protected)',
});
