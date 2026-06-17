/*
 * Terminal 1: cd demo-attacked/idor && npm install && npm run vulnerable
 * Attack guide: npm run guide → http://localhost:3041
 */

const { createPayrollApp } = require('./payroll-app');

createPayrollApp({
  port: 3040,
  protected: false,
  label: 'PayrollHub (vulnerable)',
});
