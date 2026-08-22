export default function (plop) {
  // Handlebars helper: timestamp
  plop.setHelper('timestamp', function () {
    return Date.now().toString();
  });

  // 1. GENERATOR: Full NestJS API Module
  plop.setGenerator('api-module', {
    description: 'Tạo toàn bộ NestJS Core Module chuẩn (Entity + DTOs + Service + Controller + Module + getColumnOptions)',
    prompts: [
      {
        type: 'input',
        name: 'moduleName',
        message: 'Tên thư mục module (kebab-case, vd: customer-claims-core):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên module'),
      },
      {
        type: 'input',
        name: 'entityName',
        message: 'Tên Entity chính (PascalCase, vd: CustomerClaim):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên entity'),
      },
      {
        type: 'input',
        name: 'tableName',
        message: 'Tên bảng PostgreSQL (snake_case, vd: erp_customer_claims):',
        default: (answers) => `erp_${answers.moduleName.replace(/-core$/, '').replace(/-/g, '_')}`,
      },
      {
        type: 'input',
        name: 'routePath',
        message: 'Đường dẫn API Route (kebab-case, vd: customer-claims):',
        default: (answers) => answers.moduleName.replace(/-core$/, ''),
      },
      {
        type: 'input',
        name: 'permissionResource',
        message: 'Resource RBAC Permission (snake_case, vd: customer_claims):',
        default: (answers) => answers.moduleName.replace(/-core$/, '').replace(/-/g, '_'),
      },
      {
        type: 'input',
        name: 'prefix',
        message: 'Mã tiền tố chứng từ (vd: CLM, PO, SO):',
        default: 'REC',
      },
      {
        type: 'confirm',
        name: 'hasAmount',
        message: 'Có trường số tiền / giá trị (amount) không?',
        default: true,
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/entities/{{kebabCase entityName}}.entity.ts',
        templateFile: 'plop-templates/module/entity.ts.hbs',
      },
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/dto/create-{{kebabCase entityName}}.dto.ts',
        templateFile: 'plop-templates/module/create-dto.ts.hbs',
      },
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/dto/update-{{kebabCase entityName}}.dto.ts',
        templateFile: 'plop-templates/module/update-dto.ts.hbs',
      },
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/{{kebabCase moduleName}}.service.ts',
        templateFile: 'plop-templates/module/service.ts.hbs',
      },
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/{{kebabCase moduleName}}.controller.ts',
        templateFile: 'plop-templates/module/controller.ts.hbs',
      },
      {
        type: 'add',
        path: 'src/{{kebabCase moduleName}}/{{kebabCase moduleName}}.module.ts',
        templateFile: 'plop-templates/module/module.ts.hbs',
      },
    ],
  });

  // 2. GENERATOR: TypeORM Migration
  plop.setGenerator('api-migration', {
    description: 'Tạo file TypeORM Migration chuẩn',
    prompts: [
      {
        type: 'input',
        name: 'migrationName',
        message: 'Tên Migration (PascalCase, vd: CreateCustomerClaimsTable):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên migration'),
      },
      {
        type: 'input',
        name: 'tableName',
        message: 'Tên bảng (snake_case, vd: erp_customer_claims):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên bảng'),
      },
    ],
    actions: () => {
      const ts = Date.now().toString();
      return [
        {
          type: 'add',
          path: `src/migrations/${ts}-{{kebabCase migrationName}}.ts`,
          templateFile: 'plop-templates/migration/migration.ts.hbs',
          data: {
            timestamp: ts,
          },
        },
      ];
    },
  });
}
