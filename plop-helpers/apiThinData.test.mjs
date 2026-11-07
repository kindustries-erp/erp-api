import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApiThinData, coreFieldNames, listCoreFamilies, readCoreManifest } from './apiThinData.mjs';
import { thinFileMap } from './apiThinFiles.mjs';
import { buildApiCoreData } from './apiCoreData.mjs';
import { buildCoreManifest } from './apiCoreManifest.mjs';

const engineManifest = buildCoreManifest(
  buildApiCoreData({ familyInput: 'goods-receipts', entityInput: 'GoodsReceipt', styleInput: 'engine' }),
);
const abstractManifest = buildCoreManifest(
  buildApiCoreData({ familyInput: 'procurement-orders', entityInput: 'PurchaseOrder', styleInput: 'abstract-services' }),
);

const thinAnswers = {
  moduleInput: 'goods-receipts-garage',
  entityInput: 'GarageGoodsReceipt',
  fieldSpecInput: 'code:string:required,status:status',
  // Tên thật của module đã triển khai: truyền tường minh, không để generator suy ra từ tên thư mục.
  tableNameInput: 'erp_garage_goods_receipts',
  routePathInput: 'garage-goods-receipts',
  permissionResourceInput: 'garage_goods_receipts',
  wireInput: false,
};

/** Tạo một thư mục gốc giả có src/v2/core/<họ>/core.manifest.json để test đọc họ. */
function fakeRepo(manifests) {
  const root = mkdtempSync(join(tmpdir(), 'thin-test-'));
  for (const [family, manifest] of Object.entries(manifests)) {
    mkdirSync(join(root, 'src/v2/core', family), { recursive: true });
    writeFileSync(join(root, 'src/v2/core', family, 'core.manifest.json'), JSON.stringify(manifest));
  }
  return root;
}

describe('buildApiThinData', () => {
  it('ghép module với lõi engine và dùng lại dữ liệu pipeline api-module-v2', () => {
    const data = buildApiThinData(thinAnswers, engineManifest);
    expect(data.modulePath).toBe('src/v2/modules/goods-receipts-garage');
    expect(data.moduleClass).toBe('GoodsReceiptsGarage');
    expect(data.coreBarrel).toBe('@/v2/core/goods-receipts-core');
    expect(data.coreModule).toBe('GoodsReceiptsCoreModule');
    expect(data.baseEntity).toBe('BaseGoodsReceiptEntity');
    expect(data.baseCreateDto).toBe('BaseCreateGoodsReceiptDto');
    expect(data.tableName).toBe('erp_garage_goods_receipts');
    expect(data.resourceKey).toBe('GARAGE_GOODS_RECEIPTS');
    expect(data.customFields.map((f) => f.name)).toEqual(['code', 'status']);
    expect(data.wire).toBe(false);
  });

  it('ghi nhận style abstract-services của lõi', () => {
    const data = buildApiThinData(
      { ...thinAnswers, moduleInput: 'garage-po', entityInput: 'GaragePo' },
      abstractManifest,
    );
    expect(data.style).toBe('abstract-services');
    expect(data.baseService).toBe('AbstractPurchaseOrderCommandService');
  });

  it('bật wire khi wireInput = true', () => {
    expect(buildApiThinData({ ...thinAnswers, wireInput: true }, engineManifest).wire).toBe(true);
  });

  it('từ chối trường khai trùng với lõi', () => {
    expect(() => buildApiThinData(thinAnswers, engineManifest, ['status'])).toThrow(/đã có trong lõi.*status/);
  });

  it('chỉ import decorator TypeORM đang dùng', () => {
    const data = buildApiThinData(thinAnswers, engineManifest);
    expect(data.entityTypeormImports).toContain('Column');
    expect(data.entityTypeormImports).toContain('Entity');
  });

  it('từ chối tên module rỗng', () => {
    expect(() => buildApiThinData({ ...thinAnswers, moduleInput: '' }, engineManifest)).toThrow(/Tên module/);
  });
});

describe('coreFieldNames', () => {
  it('đọc tên trường đã khai báo trong entity và DTO của lõi thật goods-receipts-core', () => {
    const names = coreFieldNames(join(import.meta.dir, '..'), 'goods-receipts-core');
    expect(names).toContain('receiptNo');
    expect(names).toContain('status');
  });
});

describe('thinFileMap', () => {
  it('sinh đủ bộ file như api-module-v2, dùng template thin cho 5 file lõi', () => {
    const data = buildApiThinData(thinAnswers, engineManifest);
    const files = thinFileMap(data);
    expect(files).toHaveLength(16);
    for (const { path } of files) expect(path.startsWith('src/v2/modules/goods-receipts-garage/')).toBe(true);
    const templates = files.map((f) => f.template);
    expect(templates).toContain('thin-common/entity.ts.hbs');
    expect(templates).toContain('thin-common/create-dto.ts.hbs');
    expect(templates).toContain('thin-common/command-service.ts.hbs');
    expect(templates).toContain('thin-common/module.ts.hbs');
    expect(templates).toContain('module-v2/controller.ts.hbs');
    expect(templates).toContain('module-v2/facade.ts.hbs');
  });
});

describe('đọc manifest họ', () => {
  it('liệt kê họ có manifest hợp lệ và bỏ qua thư mục không có', () => {
    const root = fakeRepo({ 'goods-receipts-core': engineManifest, 'procurement-orders-core': abstractManifest });
    mkdirSync(join(root, 'src/v2/core/no-manifest'), { recursive: true });
    expect(listCoreFamilies(root)).toEqual(['goods-receipts-core', 'procurement-orders-core']);
  });

  it('từ chối manifest của layer web', () => {
    const root = fakeRepo({ 'goods-receipts-core': { ...engineManifest, layer: 'web' } });
    expect(() => readCoreManifest(root, 'goods-receipts-core')).toThrow(/layer api/);
  });

  it('từ chối manifest thiếu baseClasses', () => {
    const broken = { ...engineManifest, baseClasses: { entity: 'X' } };
    const root = fakeRepo({ 'goods-receipts-core': broken });
    expect(() => readCoreManifest(root, 'goods-receipts-core')).toThrow(/baseClasses/);
  });

  it('thư mục gốc không có src/v2/core trả về danh sách rỗng', () => {
    expect(listCoreFamilies(mkdtempSync(join(tmpdir(), 'empty-')))).toEqual([]);
  });
});
