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
  // 1. Update Controller
  const controllerPath = path.join(basePath, mod, `${mod}.controller.ts`);
  let controllerCode = fs.readFileSync(controllerPath, 'utf-8');

  // Thêm @Req và Request import
  if (!controllerCode.includes('import { Request }')) {
    controllerCode = controllerCode.replace(/import \{.*?\} from '@nestjs\/common';/, (match) => {
      if (!match.includes('Req')) {
         return match.replace('}', ', Req }') + '\nimport type { Request } from \'express\';';
      }
      return match + '\nimport type { Request } from \'express\';';
    });
  }

  // Helper để lấy token
  const tokenExtractor = `    const authHeader = req.headers.authorization;\n    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;\n`;

  // Thay thế findAll
  controllerCode = controllerCode.replace(/findAll\(@Query\(\) query: (.*?)\) \{([\s\S]*?)return this\..*?\.findAll\(query\);/g, (match, type, body) => {
    return `findAll(@Query() query: ${type}, @Req() req: Request) {${tokenExtractor}    return this.${mod.replace(/-/g, '')}Service.findAll(query, token);`;
  });

  // Ghi lại controller
  fs.writeFileSync(controllerPath, controllerCode);

  // 2. Update Service
  const serviceNameMap = {
    'employees': 'EmployeesService',
    'departments': 'DepartmentsService',
    'positions': 'PositionsService',
    'company-bank-accounts': 'CompanyBankAccountsService',
    'business-partner-roles': 'BusinessPartnerRolesService',
    'chart-of-accounts': 'ChartOfAccountsService'
  };
  const servicePath = path.join(basePath, mod, `${mod}.service.ts`);
  let serviceCode = fs.readFileSync(servicePath, 'utf-8');

  // findAll: Đổi argument và logic
  serviceCode = serviceCode.replace(/async findAll\(query: (.*?)\) \{/, 'async findAll(query: $1, userToken?: string) {\n    if (!userToken) throw new import(\'@nestjs/common\').UnauthorizedException(\'Yêu cầu User Token để thực hiện tác vụ này\');');
  
  // Xóa lấy token từ config
  serviceCode = serviceCode.replace(/const token = this\.configService\.get<string>\('DIRECTUS_ADMIN_TOKEN'\);/, 'const token = userToken;');
  
  fs.writeFileSync(servicePath, serviceCode);
});

console.log('Done refactoring controllers and services for findAll');
