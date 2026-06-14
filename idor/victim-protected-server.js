/*
 * Terminal 3: cd demo-attacked/idor && npm run victim-protected
 */

const { createPayrollApp } = require('./payroll-app');

createPayrollApp({
  port: 3042,
  protected: true,
  label: 'PayrollHub (protected)',
});
