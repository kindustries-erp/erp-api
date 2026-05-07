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
  // --- 1. REFAC CONTROLLER ---
  const controllerPath = path.join(basePath, mod, `${mod}.controller.ts`);
  let ctrlCode = fs.readFileSync(controllerPath, 'utf-8');

  // Add UserToken import
  if (!ctrlCode.includes('UserToken')) {
    ctrlCode = `import { UserToken } from '../common/decorators/user-token.decorator';\n` + ctrlCode;
  }

  // Add @UserToken() token: string to methods
  ['create', 'findAll', 'findOne', 'update', 'remove'].forEach(method => {
    const regex = new RegExp(`${method}\\(([^)]*)\\) \\{`);
    ctrlCode = ctrlCode.replace(regex, (match, args) => {
      const newArgs = args ? `${args}, @UserToken() token: string` : `@UserToken() token: string`;
      return `${method}(${newArgs}) {`;
    });
  });

  // Update service calls
  ['create', 'findAll', 'findOne', 'update', 'remove'].forEach(method => {
    const serviceName = mod.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Service';
    const regexName = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
    
    // e.g. this.employeesService.create(createEmployeeDto) -> this.employeesService.create(createEmployeeDto, token)
    const callRegex = new RegExp(`this\\.${regexName}\\.${method}\\(([^)]*)\\)`);
    ctrlCode = ctrlCode.replace(callRegex, (match, args) => {
      const newArgs = args ? `${args}, token` : `token`;
      return `this.${regexName}.${method}(${newArgs})`;
    });
  });

  fs.writeFileSync(controllerPath, ctrlCode);

  // --- 2. REFAC SERVICE ---
  const servicePath = path.join(basePath, mod, `${mod}.service.ts`);
  let svcCode = fs.readFileSync(servicePath, 'utf-8');

  // Thêm import staticToken, rest nếu chưa có
  if (!svcCode.includes('staticToken')) {
    svcCode = svcCode.replace(/import \{.*?createDirectus.*?\} from '@directus\/sdk';/, (match) => {
      return match.replace('}', ', rest, staticToken }');
    });
  }
  
  if (!svcCode.includes('UnauthorizedException')) {
      svcCode = svcCode.replace(/import \{/, 'import { UnauthorizedException,');
  }

  // Update methods
  const methods = [
    { name: 'create', argsRegex: /async create\((.*?)\) \{/ },
    { name: 'findAll', argsRegex: /async findAll\((.*?)\) \{/ },
    { name: 'findOne', argsRegex: /async findOne\((.*?)\) \{/ },
    { name: 'update', argsRegex: /async update\((.*?)\) \{/ },
    { name: 'remove', argsRegex: /async remove\((.*?)\) \{/ },
  ];

  methods.forEach(m => {
    svcCode = svcCode.replace(m.argsRegex, (match, args) => {
      if (args.includes('userToken: string')) return match;
      const newArgs = args ? `${args}, userToken: string` : `userToken: string`;
      return `async ${m.name}(${newArgs}) {\n    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');\n    const directusUrl = this.configService.get<string>('DIRECTUS_URL');\n    const userClient = createDirectus(directusUrl).with(staticToken(userToken)).with(rest());`;
    });
  });

  // Replace this.directus with userClient
  svcCode = svcCode.replace(/\(this\.directus as any\)/g, '(userClient as any)');
  svcCode = svcCode.replace(/this\.directus\.request/g, 'userClient.request');

  // Fix findAll fetch token
  svcCode = svcCode.replace(/const token = this\.configService\.get<string>\('DIRECTUS_ADMIN_TOKEN'\);/g, 'const token = userToken;');
  // Also remove redundant directusUrl declaration in findAll if it was added twice
  svcCode = svcCode.replace(/const directusUrl = this\.configService\.get<string>\('DIRECTUS_URL'\);\s*const directusUrl =/g, 'const directusUrl =');

  fs.writeFileSync(servicePath, svcCode);
});

console.log('Script completed');
