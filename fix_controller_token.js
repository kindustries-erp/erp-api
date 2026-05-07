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

  // Add token arguments correctly
  ctrlCode = ctrlCode.replace(/(create\(@Body\(\) [\w]+: [\w]+\)) \{/g, '$1, @UserToken() token: string) {');
  ctrlCode = ctrlCode.replace(/(findAll\(@Query\(\) query: [\w]+\)) \{/g, '$1, @UserToken() token: string) {');
  ctrlCode = ctrlCode.replace(/(findOne\(@Param\('id'\) id: string\)) \{/g, '$1, @UserToken() token: string) {');
  ctrlCode = ctrlCode.replace(/(update\(@Param\('id'\) id: string, @Body\(\) [\w]+: [\w]+\)) \{/g, '$1, @UserToken() token: string) {');
  ctrlCode = ctrlCode.replace(/(remove\(@Param\('id'\) id: string\)) \{/g, '$1, @UserToken() token: string) {');

  fs.writeFileSync(controllerPath, ctrlCode);
});
console.log('Fixed controller arguments');
