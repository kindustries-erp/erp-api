import { buildApiV2Data } from './plop-helpers/apiV2Data.mjs';
import { moduleFileMap, rbacPlan, wiringPlan } from './plop-helpers/apiV2Files.mjs';
import {
  buildApiVoucherData,
  voucherFileMap,
  voucherRbacPlan,
  voucherWiringPlan,
} from './plop-helpers/apiVoucherData.mjs';
import { enumEntryExists, insertAtMarker } from './plop-helpers/apiV2Wiring.mjs';
import { API_CORE_STYLES, buildApiCoreData } from './plop-helpers/apiCoreData.mjs';
import { coreFileMap } from './plop-helpers/apiCoreFiles.mjs';
import { manifestJson } from './plop-helpers/apiCoreManifest.mjs';
import {
  buildApiThinData,
  coreFieldNames,
  listCoreFamilies,
  readCoreManifest,
} from './plop-helpers/apiThinData.mjs';
import { thinFileMap } from './plop-helpers/apiThinFiles.mjs';
import {
  WORKFLOW_STYLE,
  assertModuleAbsent,
  buildApiWorkflowData,
  workflowFileMap,
} from './plop-helpers/apiWorkflowData.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

  // 0. GENERATOR: Lõi họ V2 (src/v2/core/<họ>) kèm core.manifest.json
  plop.setGenerator('api-core', {
    description: 'Tạo khung lõi họ V2 (src/v2/core/<họ>) kèm core.manifest.json, style engine | abstract-services',
    prompts: [
      {
        type: 'input',
        name: 'familyInput',
        message: 'Tên họ (kebab-case, vd: customer-claims):',
        validate: (value) => (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? true : 'Dùng kebab-case, vd: customer-claims'),
      },
      {
        type: 'input',
        name: 'entityInput',
        message: 'Entity gốc (PascalCase, vd: CustomerClaim):',
        validate: (value) => (/^[A-Za-z][A-Za-z0-9]*$/.test(value) ? true : 'Dùng PascalCase, vd: CustomerClaim'),
      },
      {
        type: 'list',
        name: 'styleInput',
        message: 'Kiểu service lõi:',
        choices: API_CORE_STYLES,
        default: 'engine',
      },
    ],
    actions: (answers) => {
      // Dữ liệu được kiểm tra trước; input sai thì dừng ở đây, chưa ghi file nào.
      const data = buildApiCoreData(answers);
      if (existsSync(join(plop.getDestBasePath(), data.coreDir))) {
        throw new Error(`Họ "${data.family}" đã tồn tại tại ${data.coreDir}. Dùng module mỏng thay vì tạo lại.`);
      }
      const withManifest = { ...data, manifestJson: manifestJson(data) };
      return coreFileMap(withManifest).map(({ template, path }) => ({
        type: 'add',
        path,
        templateFile: `plop-templates/${template}`,
        data: withManifest,
      }));
    },
  });

  // 0b. GENERATOR: Module mỏng dựa trên lõi họ V2 (đọc core.manifest.json)
  plop.setGenerator('api-thin-module', {
    description:
      'Tạo module V2 mỏng ghép lõi họ có sẵn (src/v2/modules/<module>): entity/DTO kế thừa lõi, facade, controller, RBAC; tự nối app.module và data-source khi wire',
    prompts: [
      {
        type: 'list',
        name: 'coreInput',
        message: 'Chọn họ lõi có sẵn (src/v2/core/<họ>):',
        choices: () => listCoreFamilies(plop.getDestBasePath()),
      },
      {
        type: 'input',
        name: 'moduleInput',
        message: 'Tên module (kebab-case, vd: garage-customer-claims):',
        validate: (value) => (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? true : 'Dùng kebab-case'),
      },
      {
        type: 'input',
        name: 'entityInput',
        message: 'Entity của module (PascalCase, vd: GarageCustomerClaim):',
        validate: (value) => (/^[A-Za-z][A-Za-z0-9]*$/.test(value) ? true : 'Dùng PascalCase'),
      },
      {
        type: 'input',
        name: 'fieldSpecInput',
        message: 'Các trường riêng của module name:type[:required],... (type: string|text|number|decimal|boolean|date|status):',
        default: 'code:string:required,name:string:required,status:status',
      },
      {
        type: 'input',
        name: 'tableNameInput',
        message: 'Tên bảng PostgreSQL (để trống = erp_<module>):',
        default: '',
      },
      {
        type: 'input',
        name: 'routePathInput',
        message: 'Đường dẫn API (để trống = module):',
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
      const base = plop.getDestBasePath();
      const manifest = readCoreManifest(base, answers.coreInput);
      // Validate và dựng dữ liệu trước: input sai thì dừng tại đây, chưa ghi file nào.
      const data = buildApiThinData(answers, manifest, coreFieldNames(base, answers.coreInput));
      if (existsSync(join(base, data.modulePath))) {
        throw new Error(`Module "${data.moduleName}" đã tồn tại tại ${data.modulePath}.`);
      }
      return [
        ...thinFileMap(data).map(({ template, path }) => ({
          type: 'add',
          path,
          templateFile: `plop-templates/${template}`,
          data,
        })),
        ...rbacPlan(data).map(toModifyAction),
        ...wiringPlan(data).map(toModifyAction),
      ];
    },
  });

  // 0c. GENERATOR: Module workflow (chứng từ có trạng thái) ghép lõi họ abstract-services.
  // Sinh khung: entity, DTO tạo, command kế thừa lõi, controller tạo nháp + chuyển trạng thái, module, RBAC.
  // Nghiệp vụ riêng để trống, điền ở các hook // CUSTOM.
  plop.setGenerator('api-workflow-module', {
    description:
      'Tạo module chứng từ có trạng thái ghép lõi họ abstract-services (src/v2/modules/<module>): khung command, controller chuyển trạng thái, RBAC; chỗ nghiệp vụ để trống // CUSTOM',
    prompts: [
      {
        type: 'list',
        name: 'coreInput',
        message: 'Chọn họ lõi kiểu abstract-services (src/v2/core/<họ>):',
        choices: () => {
          const base = plop.getDestBasePath();
          return listCoreFamilies(base).filter(
            (family) => readCoreManifest(base, family).style === WORKFLOW_STYLE,
          );
        },
      },
      {
        type: 'input',
        name: 'moduleInput',
        message: 'Tên module (kebab-case, vd: garage-sample-orders):',
        validate: (value) => (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? true : 'Dùng kebab-case'),
      },
      {
        type: 'input',
        name: 'entityInput',
        message: 'Entity của module (PascalCase, vd: GarageSampleOrder):',
        validate: (value) => (/^[A-Za-z][A-Za-z0-9]*$/.test(value) ? true : 'Dùng PascalCase'),
      },
      {
        type: 'input',
        name: 'fieldSpecInput',
        message: 'Các trường riêng của module name:type[:required],... (không dùng status/createdBy, lõi đã có):',
        default: 'code:string:required,name:string:required',
      },
      {
        type: 'input',
        name: 'tableNameInput',
        message: 'Tên bảng PostgreSQL (để trống = erp_<module>):',
        default: '',
      },
      {
        type: 'input',
        name: 'routePathInput',
        message: 'Đường dẫn API (để trống = module):',
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
      const base = plop.getDestBasePath();
      const manifest = readCoreManifest(base, answers.coreInput);
      // Validate và dựng dữ liệu trước: input sai hoặc module đã có thì dừng tại đây, chưa ghi file nào.
      const data = buildApiWorkflowData(answers, manifest, coreFieldNames(base, answers.coreInput));
      assertModuleAbsent(base, data);
      return [
        ...workflowFileMap(data).map(({ template, path }) => ({
          type: 'add',
          path,
          templateFile: `plop-templates/${template}`,
          data,
        })),
        ...rbacPlan(data).map(toModifyAction),
        ...wiringPlan(data).map(toModifyAction),
      ];
    },
  });

  // 1. GENERATOR: Full NestJS API Module
  plop.setGenerator('api-module', {
    description:
      '[LEGACY-V1] Tạo module V1 (src/<module>) với Entity + DTOs + Service + Controller. Module V2 mới dùng api-core, api-thin-module hoặc api-module-v2',
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
    description: 'Tạo module API v2 theo kiến trúc Facade + sub-services, kèm spec (xem skill api-structure)',
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

  // 4. GENERATOR: API v2 voucher module (Header + Lines Document, Transaction, Vòng đời DRAFT/POSTED/CANCELLED)
  plop.setGenerator('api-voucher-v2', {
    description:
      'Tạo module API v2 chứng từ Header + Lines (Document/Voucher) kèm vòng đời POST/CANCEL. Họ đã có lõi trong src/v2/core: dùng api-thin-module',
    prompts: [
      {
        type: 'input',
        name: 'moduleInput',
        message: 'Tên module (kebab-case, vd: garage-goods-issues-core):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên module'),
      },
      {
        type: 'input',
        name: 'headerEntityInput',
        message: 'Tên Entity Header chính (PascalCase, vd: GarageGoodsIssue):',
        validate: (value) => (/.+/.test(value) ? true : 'Vui lòng nhập tên entity header'),
      },
      {
        type: 'input',
        name: 'lineEntityInput',
        message: 'Tên Entity Detail Line (PascalCase, vd: GarageGoodsIssueLine):',
        default: (answers) => `${answers.headerEntityInput}Line`,
      },
      {
        type: 'input',
        name: 'voucherPrefixInput',
        message: 'Tiền tố mã chứng từ (vd: GGI, GR, PO, SO):',
        default: 'REC',
      },
      {
        type: 'input',
        name: 'tableNameInput',
        message: 'Tên bảng PostgreSQL Header (để trống = erp_<module không -core>):',
        default: '',
      },
      {
        type: 'input',
        name: 'lineTableNameInput',
        message: 'Tên bảng PostgreSQL Lines (để trống = <header_table>_lines):',
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
      const data = buildApiVoucherData(answers);
      // Họ đã có lõi thì cảnh báo: sinh lại Header/Line từ đầu sẽ nhân bản logic của lõi.
      if (existsSync(join(plop.getDestBasePath(), 'src/v2/core', data.moduleBase, 'core.manifest.json'))) {
        console.warn(
          `[api-voucher-v2] Họ "${data.moduleBase}" đã có lõi tại src/v2/core/${data.moduleBase}. Nên dùng api-thin-module để ghép lõi.`,
        );
      }
      return [
        ...voucherFileMap(data).map(({ template, path }) => ({
          type: 'add',
          path,
          templateFile: `plop-templates/voucher-v2/${template}`,
          data,
        })),
        ...voucherRbacPlan(data).map(toModifyAction),
        ...voucherWiringPlan(data).map(toModifyAction),
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
