/*
 * Terminal 1: cd demo-attacked/path-traversal && npm install && npm run vulnerable
 * Attack guide: npm run guide → http://localhost:3044
 */

const { createFileVaultApp } = require('./filevault-app');

createFileVaultApp({
  port: 3043,
  protected: false,
  label: 'FileVault (vulnerable)',
});
