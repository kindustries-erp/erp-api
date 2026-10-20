import { describe, expect, it } from 'bun:test';
import { buildApiV2Data, toKebab, toPascal } from './apiV2Data.mjs';
import { moduleFileMap, rbacPlan, wiringPlan } from './apiV2Files.mjs';

const base = {
  moduleInput: 'customer-claims-core',
  entityInput: 'CustomerClaim',
  tableNameInput: '',
  routePathInput: '',
  permissionResourceInput: '',
  fieldSpecInput: 'code:string:required,amount:decimal,status:status',
  wireInput: false,
};

describe('case helpers', () => {
  it('converts names to kebab and pascal', () => {
    expect(toKebab('CustomerClaim')).toBe('customer-claim');
    expect(toPascal('customer-claims-core')).toBe('CustomerClaimsCore');
  });
});

describe('buildApiV2Data', () => {
  it('derives table, route and permission names from the module name', () => {
    const data = buildApiV2Data(base);
    expect(data.tableName).toBe('erp_customer_claims');
    expect(data.routePath).toBe('customer-claims');
    expect(data.permissionResource).toBe('customer_claims');
    expect(data.serviceClass).toBe('CustomerClaimsCoreService');
  });

  it('keeps createdAt out of the custom fields', () => {
    const data = buildApiV2Data(base);
    expect(data.customFields.map((f) => f.name)).toEqual(['code', 'amount', 'status']);
    expect(data.hasStatus).toBe(true);
  });

  it('maps field types to entity column, DTO validator and response expression', () => {
    const [code, amount] = buildApiV2Data(base).customFields;
    expect(code.entityColumn).toContain("type: 'varchar', length: 255");
    expect(code.dtoDecorators).toEqual(['@ApiProperty()', '@IsNotEmpty()', '@IsString()']);
    expect(amount.tsType).toBe('string');
    expect(amount.responseType).toBe('number');
    expect(amount.mapExpression).toBe('entity.amount == null ? undefined : Number(entity.amount)');
    expect(amount.dtoDecorators).toContain('@IsNumber()');
    expect(amount.toEntityExpression).toBe('dto.amount === undefined ? undefined : String(dto.amount)');
  });

  it('maps camelCase fields to snake_case columns and lists only used validators', () => {
    const data = buildApiV2Data({ ...base, fieldSpecInput: 'docDate:date:required,code:string:required' });
    expect(data.customFields[0].entityColumn).toContain("name: 'doc_date'");
    expect(data.classValidatorImports).toEqual(['IsDateString', 'IsNotEmpty', 'IsString']);
    expect(data.swaggerImports).toEqual(['ApiProperty']);
  });

  it('requires at least one business field', () => {
    expect(() => buildApiV2Data({ ...base, fieldSpecInput: '' })).toThrow(/ít nhất một trường/);
  });

  it('marks optional fields nullable and optional in DTO', () => {
    const data = buildApiV2Data({ ...base, fieldSpecInput: 'note:text' });
    const [note] = data.customFields;
    expect(note.entityColumn).toContain('nullable: true');
    expect(note.dtoDecorators[1]).toBe('@IsOptional()');
  });

  it('rejects invalid module and entity names before any file is written', () => {
    expect(() => buildApiV2Data({ ...base, moduleInput: 'Bad Module!' })).toThrow(/Tên module không hợp lệ/);
    expect(() => buildApiV2Data({ ...base, entityInput: 'customer-claim' })).toThrow(/Tên entity không hợp lệ/);
  });
});

describe('moduleFileMap', () => {
  it('lists 16 files under src/<module>/ with co-located specs', () => {
    const files = moduleFileMap(buildApiV2Data(base));
    expect(files).toHaveLength(16);
    expect(files.every((f) => f.path.startsWith('src/v2/customer-claims-core/'))).toBe(true);
    const specs = files.filter((f) => f.path.endsWith('.spec.ts'));
    expect(specs).toHaveLength(5);
  });

  it('places the facade at the module root and sub-units in their folders', () => {
    const paths = moduleFileMap(buildApiV2Data(base)).map((f) => f.path);
    expect(paths).toContain('src/v2/customer-claims-core/customer-claims-core.service.ts');
    expect(paths).toContain('src/v2/customer-claims-core/services/customer-claim-query.service.ts');
    expect(paths).toContain('src/v2/customer-claims-core/controllers/customer-claim.controller.ts');
  });
});

describe('wiringPlan', () => {
  it('returns nothing when wire is off', () => {
    expect(wiringPlan(buildApiV2Data(base))).toEqual([]);
  });

  it('plans four marker insertions when wire is on', () => {
    const plan = wiringPlan(buildApiV2Data({ ...base, wireInput: true }));
    expect(plan).toHaveLength(4);
    expect(plan.map((p) => p.file)).toEqual([
      'src/app.module.ts',
      'src/app.module.ts',
      'src/db/data-source.ts',
      'src/db/data-source.ts',
    ]);
    expect(plan[1].snippet).toBe('    CustomerClaimsCoreModule,');
    expect(plan[3].snippet).toBe('  CustomerClaim,');
  });
});

describe('rbacPlan', () => {
  it('registers the RBAC resource even when wire is off', () => {
    const [item] = rbacPlan(buildApiV2Data(base));
    expect(item.file).toBe('src/rbac-core/enums/erp-resource.enum.ts');
    expect(item.snippet).toBe("  CUSTOMER_CLAIMS = 'customer_claims',");
  });
});

describe('table query data (whitelist, summary, search)', () => {
  it('builds sql-qualified table columns with snake_case aliases and always includes createdAt', () => {
    const data = buildApiV2Data(base);
    expect(data.tableColumnsLiteral).toContain('"code": { sql: "e.code", type: "text" }');
    expect(data.tableColumnsLiteral).toContain('"status": { sql: "e.status", type: "status" }');
    expect(data.tableColumnsLiteral).toContain('"createdAt": { sql: "e.createdAt", type: "date" }');
  });

  it('emits a snake_case alias only when the name differs', () => {
    const data = buildApiV2Data({ ...base, fieldSpecInput: 'contactName:string,amount:decimal' });
    expect(data.tableColumnsLiteral).toContain('"contactName": { sql: "e.contactName", type: "text" }');
    expect(data.tableColumnsLiteral).toContain('"contact_name": { sql: "e.contactName", type: "text" }');
    expect(data.tableColumnsLiteral).not.toContain('"code"');
  });

  it('sums only number and decimal fields, keyed by field name', () => {
    const data = buildApiV2Data(base);
    expect(data.hasSummaryColumns).toBe(true);
    expect(data.summaryColumnsKeys).toEqual(['amount']);
    expect(data.summaryColumnsLiteral).toBe('[{"key":"amount","sql":"e.amount"}]');
  });

  it('reports no summary columns when the module has no numeric field', () => {
    const data = buildApiV2Data({ ...base, fieldSpecInput: 'code:string:required,name:string' });
    expect(data.hasSummaryColumns).toBe(false);
    expect(data.summaryColumnsLiteral).toBe('[]');
  });

  it('exposes search columns as sql expressions for the keyword filter', () => {
    const data = buildApiV2Data(base);
    expect(data.searchColumnsLiteral).toBe('["e.code"]');
  });

  it('leaves boolean fields out of the table column whitelist', () => {
    const data = buildApiV2Data({ ...base, fieldSpecInput: 'code:string,active:boolean' });
    expect(data.tableColumnsLiteral).not.toContain('active');
  });
});

describe('mapper expressions for nullable entity columns', () => {
  it('maps optional string, text, number and date to undefined instead of null', () => {
    const data = buildApiV2Data({
      ...base,
      fieldSpecInput: 'code:string:required,title:string,body:text,qty:number,due:date',
    });
    const byName = Object.fromEntries(data.customFields.map((f) => [f.name, f.mapExpression]));
    expect(byName.title).toBe('entity.title ?? undefined');
    expect(byName.body).toBe('entity.body ?? undefined');
    expect(byName.qty).toBe('entity.qty ?? undefined');
    expect(byName.due).toBe('entity.due ?? undefined');
    expect(byName.code).toBe('entity.code');
  });
});

describe('v2 location and wiring', () => {
  it('wires the module from src/v2 and imports the entity with the @/v2 alias', () => {
    const data = buildApiV2Data({
      moduleInput: 'customer-claims-core',
      entityInput: 'CustomerClaim',
      tableNameInput: '',
      routePathInput: '',
      permissionResourceInput: '',
      fieldSpecInput: 'code:string:required',
      wireInput: true,
    });
    const snippets = wiringPlan(data).map((item) => item.snippet);
    expect(snippets).toContain(`import { CustomerClaimsCoreModule } from './v2/customer-claims-core/customer-claims-core.module';`);
    expect(snippets).toContain(`import { CustomerClaim } from '@/v2/customer-claims-core/entities/customer-claim.entity';`);
  });
});
