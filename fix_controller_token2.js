const fs = require('fs');
const path = require('path');

const modules = [
  'employees',
  'departments',
  'positions',
  'company-bank-accounts',
  'business-partner-roles',
  'chart-of-accounts'
];

const basePath = path.join(__dirname, 'src');

modules.forEach(mod => {
  const controllerPath = path.join(basePath, mod, `${mod}.controller.ts`);
  let ctrlCode = fs.readFileSync(controllerPath, 'utf-8');

  // Fix the previously broken arguments
  ctrlCode = ctrlCode.replace(/\), @UserToken\(\) token: string\) \{/g, ', @UserToken() token: string) {');

  fs.writeFileSync(controllerPath, ctrlCode);
});
console.log('Fixed syntax errors');
