import { hasStatusApiV2Field, parseApiV2Fields } from './apiV2Fields.mjs';

const KEBAB_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ENTITY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const STATUS_VALUES = ['ACTIVE', 'INACTIVE'];
const SAMPLE_DATE = "'2026-01-01T00:00:00.000Z'";

export const toKebab = (value) =>
  String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const toPascal = (value) =>
  String(value ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');

export const toCamel = (value) => {
  const pascal = toPascal(value);
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : '';
};

export const toSnake = (value) => toKebab(value).replace(/-/g, '_');

/**
 * Quy tắc theo từng kiểu trường.
 * - `column(extra)`: decorator cột TypeORM, `extra` là các option bổ sung (name, nullable).
 * - `validator`: decorator class-validator dùng trong DTO tạo mới.
 * - `toEntity(name)`: biểu thức đổi giá trị DTO sang kiểu của entity.
 * - `map(name, required)`: biểu thức đổi entity sang giá trị của response DTO.
 * - `fixture`/`dtoFixture`/`responseExpect`/`entityExpect`: literal dùng cho spec sinh ra.
 */
/** Cột nullable trong entity (`string | null`) thì response trả `undefined` thay vì `null`. */
const orUndefined = (name, required) => (required ? `entity.${name}` : `entity.${name} ?? undefined`);

const typeRules = {
  string: {
    tsType: 'string',
    dtoType: 'string',
    responseType: 'string',
    validator: '@IsString()',
    column: (extra) => `@Column({ type: 'varchar', length: 255${extra} })`,
    toEntity: (name) => `dto.${name}`,
    map: (name, required) => orUndefined(name, required),
    fixture: "'sample'",
    dtoFixture: "'sample'",
    responseExpect: "'sample'",
    entityExpect: "'sample'",
  },
  text: {
    tsType: 'string',
    dtoType: 'string',
    responseType: 'string',
    validator: '@IsString()',
    column: (extra) => `@Column({ type: 'text'${extra} })`,
    toEntity: (name) => `dto.${name}`,
    map: (name, required) => orUndefined(name, required),
    fixture: "'sample'",
    dtoFixture: "'sample'",
    responseExpect: "'sample'",
    entityExpect: "'sample'",
  },
  number: {
    tsType: 'number',
    dtoType: 'number',
    responseType: 'number',
    validator: '@IsInt()',
    column: (extra) => `@Column({ type: 'integer'${extra} })`,
    toEntity: (name) => `dto.${name}`,
    map: (name, required) => orUndefined(name, required),
    fixture: '1',
    dtoFixture: '1',
    responseExpect: '1',
    entityExpect: '1',
  },
  // TypeORM trả numeric dưới dạng string, nên entity giữ string và response ép về number.
  decimal: {
    tsType: 'string',
    dtoType: 'number',
    responseType: 'number',
    validator: '@IsNumber()',
    column: (extra) => `@Column({ type: 'numeric', precision: 18, scale: 2${extra} })`,
    toEntity: (name) => `dto.${name} === undefined ? undefined : String(dto.${name})`,
    map: (name, required) =>
      required ? `Number(entity.${name})` : `entity.${name} == null ? undefined : Number(entity.${name})`,
    fixture: "'12.50'",
    dtoFixture: '12.5',
    responseExpect: '12.5',
    entityExpect: "'12.5'",
  },
  boolean: {
    tsType: 'boolean',
    dtoType: 'boolean',
    responseType: 'boolean',
    validator: '@IsBoolean()',
    column: (extra) => `@Column({ type: 'boolean', default: false${extra} })`,
    toEntity: (name) => `dto.${name}`,
    map: (name) => `entity.${name}`,
    fixture: 'true',
    dtoFixture: 'true',
    responseExpect: 'true',
    entityExpect: 'true',
  },
  date: {
    tsType: 'Date',
    dtoType: 'string',
    responseType: 'Date',
    validator: '@IsDateString()',
    column: (extra) => `@Column({ type: 'timestamptz'${extra} })`,
    toEntity: (name) => `dto.${name} === undefined ? undefined : new Date(dto.${name})`,
    map: (name, required) => orUndefined(name, required),
    fixture: `new Date(${SAMPLE_DATE})`,
    dtoFixture: SAMPLE_DATE,
    responseExpect: `new Date(${SAMPLE_DATE})`,
    entityExpect: `new Date(${SAMPLE_DATE})`,
  },
  status: {
    tsType: 'string',
    dtoType: 'string',
    responseType: 'string',
    validator: `@IsIn(${JSON.stringify(STATUS_VALUES)})`,
    column: (extra) => `@Index()\n  @Column({ type: 'varchar', length: 50, default: 'ACTIVE'${extra} })`,
    toEntity: (name) => `dto.${name}`,
    map: (name) => `entity.${name}`,
    fixture: "'ACTIVE'",
    dtoFixture: "'ACTIVE'",
    responseExpect: "'ACTIVE'",
    entityExpect: "'ACTIVE'",
  },
};

/** Gắn sẵn các đoạn code đã render cho từng trường, để template chỉ việc in ra. */
function decorateField(field) {
  const rule = typeRules[field.type];
  // boolean và status luôn NOT NULL vì đã có default, nên không cần nullable.
  const alwaysNotNull = field.type === 'boolean' || field.type === 'status';
  const nullable = field.required || alwaysNotNull ? '' : ', nullable: true';
  const optional = field.required ? '@IsNotEmpty()' : '@IsOptional()';
  const swagger = field.required ? '@ApiProperty()' : '@ApiPropertyOptional()';
  return {
    name: field.name,
    type: field.type,
    required: field.required,
    tsType: rule.tsType,
    dtoType: rule.dtoType,
    responseType: rule.responseType,
    nullableMark: field.required ? '' : '?',
    validator: rule.validator,
    entityColumn: rule.column(`, name: '${toSnake(field.name)}'${nullable}`),
    dtoDecorators: [swagger, optional, rule.validator],
    responseSwagger: field.required ? '@ApiProperty()' : '@ApiPropertyOptional()',
    mapExpression: rule.map(field.name, field.required),
    toEntityExpression: rule.toEntity(field.name),
    fixture: rule.fixture,
    dtoFixture: rule.dtoFixture,
    responseExpect: rule.responseExpect,
    entityExpect: rule.entityExpect,
  };
}

const TABLE_TYPE_BY_FIELD = {
  string: 'text',
  text: 'text',
  status: 'status',
  number: 'number',
  decimal: 'number',
  date: 'date',
};

/** Cột lọc/sắp xếp được: createdAt luôn có, còn lại theo kiểu trường (boolean bị bỏ). */
export function tableColumnsFor(fields) {
  const columns = [{ name: 'createdAt', type: 'date' }];
  for (const field of fields) {
    const type = TABLE_TYPE_BY_FIELD[field.type];
    if (type) columns.push({ name: field.name, type });
  }
  return columns;
}

/** Literal TypeScript của `TableColumnMap`, khai báo cả key camelCase và snake_case. */
export function tableColumnsLiteral(columns) {
  const entry = (key, name, type) =>
    `  ${JSON.stringify(key)}: { sql: ${JSON.stringify(`e.${name}`)}, type: ${JSON.stringify(type)} },`;
  const lines = columns.flatMap(({ name, type }) => {
    const snake = toSnake(name);
    return snake === name ? [entry(name, name, type)] : [entry(name, name, type), entry(snake, name, type)];
  });
  return `{\n${lines.join('\n')}\n}`;
}

/**
 * Chuẩn hóa input của prompt thành dữ liệu cho template.
 * Ném lỗi sớm (trước khi ghi file) nếu input không hợp lệ.
 */
export function buildApiV2Data(answers) {
  const moduleName = toKebab(answers.moduleInput);
  if (!KEBAB_PATTERN.test(moduleName)) {
    throw new Error(`Tên module không hợp lệ: "${answers.moduleInput}" (kebab-case, ví dụ: customer-claims-core)`);
  }

  const entityName = String(answers.entityInput ?? '').trim();
  if (!ENTITY_PATTERN.test(entityName)) {
    throw new Error(`Tên entity không hợp lệ: "${answers.entityInput}" (PascalCase, chữ và số)`);
  }

  const baseName = moduleName.replace(/-core$/, '');
  const permissionResource = toSnake(answers.permissionResourceInput || baseName);
  const customSpecs = parseApiV2Fields(answers.fieldSpecInput).filter((field) => field.name !== 'createdAt');
  if (customSpecs.length === 0) {
    throw new Error('Cần ít nhất một trường nghiệp vụ trong fieldSpec (ví dụ: code:string:required)');
  }

  const fields = customSpecs.map(decorateField);
  const hasRequiredField = fields.some((f) => f.required);
  const hasOptionalField = fields.some((f) => !f.required);

  // Chỉ import đúng decorator đang dùng, để lint không báo import thừa.
  const classValidatorImports = new Set(fields.map((f) => f.validator.match(/^@(\w+)/)[1]));
  if (hasRequiredField) classValidatorImports.add('IsNotEmpty');
  if (hasOptionalField) classValidatorImports.add('IsOptional');

  const swaggerImports = [];
  if (hasRequiredField) swaggerImports.push('ApiProperty');
  if (hasOptionalField) swaggerImports.push('ApiPropertyOptional');

  const searchColumns = fields.filter((f) => f.type === 'string' || f.type === 'text').map((f) => f.name);

  // Whitelist cột cho bộ lọc/sắp xếp/tổng. Boolean không lọc được bằng toán tử văn bản nên bị bỏ.
  const tableColumns = tableColumnsFor(customSpecs);
  const summaryFields = fields.filter((f) => f.type === 'number' || f.type === 'decimal').map((f) => f.name);

  return {
    moduleName,
    moduleClass: toPascal(moduleName),
    serviceClass: `${toPascal(moduleName)}Service`,
    entityName,
    entityKebab: toKebab(entityName),
    entityCamel: toCamel(entityName),
    tableName: toSnake(answers.tableNameInput || `erp_${baseName}`),
    routePath: toKebab(answers.routePathInput || baseName),
    permissionResource,
    resourceKey: permissionResource.toUpperCase(),
    customFields: fields,
    classValidatorImports: [...classValidatorImports].sort(),
    swaggerImports,
    hasOptionalField,
    searchColumns,
    // Biểu thức SQL có alias `e.` để dùng trực tiếp trong query builder
    searchColumnsLiteral: JSON.stringify(searchColumns.map((name) => `e.${name}`)),
    hasSearchColumns: searchColumns.length > 0,
    tableColumnsLiteral: tableColumnsLiteral(tableColumns),
    summaryColumnsLiteral: JSON.stringify(
      summaryFields.map((name) => ({ key: name, sql: `e.${name}` })),
    ),
    hasSummaryColumns: summaryFields.length > 0,
    summaryColumnsKeys: summaryFields,
    hasStatus: hasStatusApiV2Field(customSpecs),
    statusValues: STATUS_VALUES,
    wire: Boolean(answers.wireInput),
  };
}
