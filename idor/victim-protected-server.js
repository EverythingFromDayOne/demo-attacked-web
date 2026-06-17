/*
 * Terminal 3: cd demo-attacked/idor && npm run secure
 */

const { createPayrollApp } = require('./payroll-app');

createPayrollApp({
  port: 3042,
  protected: true,
  label: 'PayrollHub (protected)',
});
