import { buildApiV2Data } from './plop-helpers/apiV2Data.mjs';
import { moduleFileMap, rbacPlan, wiringPlan } from './plop-helpers/apiV2Files.mjs';
import { enumEntryExists, insertAtMarker } from './plop-helpers/apiV2Wiring.mjs';

/** Biến một mục wiring thành action `modify` có chèn idempotent tại marker. */
const toModifyAction = (item) => ({
  type: 'modify',
  path: item.file,
  // Resource RBAC đã tồn tại (module cũ) thì giữ nguyên, không thêm key trùng
  transform: (content) =>
    enumEntryExists(content, item.snippet)
      ? content
      : insertAtMarker(content, { marker: item.marker, snippet: item.snippet, tag: item.tag }),
});

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

  // 3. GENERATOR: API v2 module (Facade + sub-services + helpers + response DTO + spec co-located)
  plop.setGenerator('api-module-v2', {
    description: 'Tạo module API v2 theo kiến trúc Facade + sub-services, kèm spec (xem skill api-v2-refactor)',
    prompts: [
      {
        type: 'input',
        name: 'moduleInput',
        message: 'Tên module (kebab-case, vd: customer-claims-core):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên module'),
      },
      {
        type: 'input',
        name: 'entityInput',
        message: 'Tên entity chính (PascalCase, vd: CustomerClaim):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên entity'),
      },
      {
        type: 'input',
        name: 'fieldSpecInput',
        message: 'Các trường nghiệp vụ name:type[:required],... (type: string|text|number|decimal|boolean|date|status):',
        default: 'code:string:required,name:string:required,status:status',
      },
      {
        type: 'input',
        name: 'tableNameInput',
        message: 'Tên bảng PostgreSQL (để trống = erp_<module không -core>):',
        default: '',
      },
      {
        type: 'input',
        name: 'routePathInput',
        message: 'Đường dẫn API (để trống = module không -core):',
        default: '',
      },
      {
        type: 'input',
        name: 'permissionResourceInput',
        message: 'Resource RBAC snake_case (để trống = theo module):',
        default: '',
      },
      {
        type: 'confirm',
        name: 'wireInput',
        message: 'Nối tự động vào app.module.ts và data-source.ts? (resource RBAC luôn được đăng ký)',
        default: false,
      },
    ],
    actions: (answers) => {
      // Validate và dựng dữ liệu trước: input sai thì dừng tại đây, chưa ghi file nào.
      const data = buildApiV2Data(answers);
      return [
        ...moduleFileMap(data).map(({ template, path }) => ({
          type: 'add',
          path,
          templateFile: `plop-templates/module-v2/${template}`,
          data,
        })),
        ...rbacPlan(data).map(toModifyAction),
        ...wiringPlan(data).map(toModifyAction),
      ];
    },
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
