/*
 * Terminal 1: cd demo-attacked/idor && npm install && npm run victim
 * Attack guide: npm run attacker → http://localhost:3041
 */

const { createPayrollApp } = require('./payroll-app');

createPayrollApp({
  port: 3040,
  protected: false,
  label: 'PayrollHub (vulnerable)',
});
