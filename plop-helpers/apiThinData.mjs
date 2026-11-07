import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildApiV2Data } from './apiV2Data.mjs';
import { API_CORE_STYLES } from './apiCoreData.mjs';

const MANIFEST_FIELDS = ['family', 'style', 'module', 'moduleFile', 'barrel'];
const MANIFEST_CLASSES = ['entity', 'createDto', 'contract', 'service'];

/** Đọc `core.manifest.json` của các họ trong `src/v2/core/` (chỉ họ có manifest hợp lệ). */
export function listCoreFamilies(baseDir) {
  const coreRoot = join(baseDir, 'src/v2/core');
  if (!existsSync(coreRoot)) return [];
  return readdirSync(coreRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((family) => {
      if (!family.endsWith('-core')) return false;
      try {
        readCoreManifest(baseDir, family);
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

/** Đọc và kiểm tra manifest của một họ. Ném lỗi nếu thiếu trường hoặc sai layer. */
export function readCoreManifest(baseDir, family) {
  const path = join(baseDir, 'src/v2/core', family, 'core.manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.layer !== 'api') throw new Error(`Manifest của họ "${family}" không phải layer api`);
  if (manifest.family !== family) {
    throw new Error(`Manifest của họ "${family}" khai báo family "${manifest.family}", phải trùng tên thư mục`);
  }
  for (const key of MANIFEST_FIELDS) {
    if (!manifest[key]) throw new Error(`Manifest của họ "${family}" thiếu trường "${key}"`);
  }
  for (const key of MANIFEST_CLASSES) {
    if (!manifest.baseClasses?.[key]) throw new Error(`Manifest của họ "${family}" thiếu baseClasses.${key}`);
  }
  if (!API_CORE_STYLES.includes(manifest.style)) {
    throw new Error(`Style "${manifest.style}" của họ "${family}" không hợp lệ`);
  }
  return manifest;
}

const CORE_FIELD_PATTERN = /^ {2}(\w+)[?!]?:/gm;

/**
 * Tên trường đã khai báo trong entity và DTO của lõi họ. Module mỏng không được khai trùng các trường này.
 * Đọc theo khai báo thuộc tính cấp class (thụt lề 2 khoảng trắng) trong `entities/` và `dto/`.
 */
export function coreFieldNames(baseDir, family) {
  const names = new Set();
  for (const sub of ['entities', 'dto']) {
    const dir = join(baseDir, 'src/v2/core', family, sub);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(dir, file), 'utf8');
      for (const match of source.matchAll(CORE_FIELD_PATTERN)) names.add(match[1]);
    }
  }
  return [...names].sort();
}

/**
 * Chuẩn hóa đầu vào của generator `api-thin-module` và ghép với manifest của họ đã chọn.
 * Phần module (field, route, RBAC, wiring) lấy từ `buildApiV2Data` để dùng lại pipeline `api-module-v2`.
 * Entity và create DTO kế thừa Base của lõi; module import module lõi.
 * `coreFields`: tên trường lõi đã có (từ `coreFieldNames`); trùng tên thì ném lỗi trước khi ghi file.
 */
export function buildApiThinData(answers, manifest, coreFields = []) {
  const v2 = buildApiV2Data(answers);

  const clash = v2.customFields.map((field) => field.name).filter((name) => coreFields.includes(name));
  if (clash.length > 0) {
    throw new Error(
      `Trường đã có trong lõi họ "${manifest.family}": ${clash.join(', ')}. Bỏ khỏi fieldSpec, lõi đã cung cấp.`,
    );
  }

  // Import đúng decorator TypeORM đang dùng (Column, Entity, và Index nếu có cột @Index)
  const typeormImports = new Set(['Column', 'Entity']);
  for (const field of v2.customFields) {
    for (const match of field.entityColumn.matchAll(/@(\w+)\(/g)) typeormImports.add(match[1]);
  }

  return {
    ...v2,
    entityTypeormImports: [...typeormImports].sort(),
    wire: Boolean(answers.wireInput),
    modulePath: `src/v2/modules/${v2.moduleName}`,
    family: manifest.family,
    style: manifest.style,
    coreBarrel: `@/v2/core/${manifest.family}`,
    coreModule: manifest.module,
    baseEntity: manifest.baseClasses.entity,
    baseCreateDto: manifest.baseClasses.createDto,
    baseService: manifest.baseClasses.service,
  };
}
