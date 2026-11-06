import { describe, expect, it } from 'bun:test';
import { buildApiCoreData, API_CORE_STYLES } from './apiCoreData.mjs';
import { coreFileMap } from './apiCoreFiles.mjs';
import { buildCoreManifest, manifestJson } from './apiCoreManifest.mjs';

const engineAnswers = { familyInput: 'customer-claims', entityInput: 'CustomerClaim', styleInput: 'engine' };
const abstractAnswers = { familyInput: 'procurement-orders', entityInput: 'PurchaseOrder', styleInput: 'abstract-services' };

describe('buildApiCoreData', () => {
  it('chuẩn hóa họ engine', () => {
    const data = buildApiCoreData(engineAnswers);
    expect(data.coreDir).toBe('src/v2/core/customer-claims-core');
    expect(data.familyPascal).toBe('CustomerClaims');
    expect(data.baseEntity).toBe('BaseCustomerClaimEntity');
    expect(data.serviceClass).toBe('BaseCustomerClaimsEngineService');
    expect(data.serviceFile).toBe('base-customer-claims-engine.service');
    expect(data.moduleClass).toBe('CustomerClaimsCoreModule');
    expect(data.serviceTemplateDir).toBe('core-engine');
  });

  it('chuẩn hóa họ abstract-services', () => {
    const data = buildApiCoreData(abstractAnswers);
    expect(data.serviceClass).toBe('AbstractPurchaseOrderCommandService');
    expect(data.serviceFile).toBe('abstract-purchase-order-command.service');
    expect(data.serviceTemplateDir).toBe('workflow-common');
    // Lớp abstract không được đăng ký làm provider (Nest không khởi tạo được)
    expect(data.moduleProviders).toBe('');
  });

  it('kiểu engine đăng ký service cụ thể làm provider', () => {
    expect(buildApiCoreData(engineAnswers).moduleProviders).toBe('BaseCustomerClaimsEngineService');
  });

  it('từ chối tên họ không phải kebab-case', () => {
    expect(() => buildApiCoreData({ ...engineAnswers, familyInput: 'CustomerClaims' })).toThrow(/Tên họ/);
    expect(() => buildApiCoreData({ ...engineAnswers, familyInput: '' })).toThrow(/Tên họ/);
  });

  it('từ chối entity không phải PascalCase', () => {
    expect(() => buildApiCoreData({ ...engineAnswers, entityInput: 'customer_claim' })).toThrow(/Tên entity/);
  });

  it('từ chối style lạ', () => {
    expect(() => buildApiCoreData({ ...engineAnswers, styleInput: 'facade' })).toThrow(/Style/);
    expect(API_CORE_STYLES).toEqual(['engine', 'abstract-services']);
  });
});

describe('coreFileMap', () => {
  it('sinh đủ 8 file và đều nằm trong src/v2/core/<họ>', () => {
    const files = coreFileMap(buildApiCoreData(engineAnswers));
    expect(files).toHaveLength(8);
    for (const { path } of files) {
      expect(path.startsWith('src/v2/core/customer-claims-core/')).toBe(true);
    }
  });

  it('chọn đúng template theo style', () => {
    const engine = coreFileMap(buildApiCoreData(engineAnswers)).map((f) => f.template);
    const abstract = coreFileMap(buildApiCoreData(abstractAnswers)).map((f) => f.template);
    expect(engine).toContain('core-engine/service.ts.hbs');
    expect(abstract).toContain('workflow-common/service.ts.hbs');
    expect(abstract).toContain('workflow-common/contract.ts.hbs');
    expect(abstract).not.toContain('core-engine/service.ts.hbs');
  });
});

describe('core.manifest.json', () => {
  it('ghi đủ thông tin để module mỏng đọc', () => {
    const data = buildApiCoreData(abstractAnswers);
    const manifest = buildCoreManifest(data);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.style).toBe('abstract-services');
    expect(manifest.barrel).toBe('src/v2/core/procurement-orders-core/index.ts');
    expect(manifest.baseClasses.entity).toBe('BasePurchaseOrderEntity');
    expect(manifest.baseClasses.contract).toBe('BasePurchaseOrderContract');
  });

  it('manifestJson là JSON hợp lệ và kết thúc bằng xuống dòng', () => {
    const json = manifestJson(buildApiCoreData(engineAnswers));
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json).family).toBe('customer-claims-core');
  });
});

describe('quy ước hậu tố -core của họ lõi', () => {
  it('nhận tên có hoặc không có -core và cho cùng kết quả thư mục, family, file module', () => {
    const plain = buildApiCoreData(engineAnswers);
    const suffixed = buildApiCoreData({ ...engineAnswers, familyInput: 'customer-claims-core' });
    expect(suffixed.family).toBe('customer-claims-core');
    expect(suffixed.coreDir).toBe(plain.coreDir);
    expect(suffixed.moduleFile).toBe('customer-claims-core.module');
    expect(suffixed.moduleClass).toBe('CustomerClaimsCoreModule');
    expect(suffixed.serviceClass).toBe(plain.serviceClass);
    expect(suffixed.serviceFile).toBe(plain.serviceFile);
  });

  it('không nhân đôi -core khi tên đã có sẵn hậu tố', () => {
    const data = buildApiCoreData({ ...engineAnswers, familyInput: 'customer-claims-core' });
    expect(data.coreDir).not.toContain('-core-core');
    expect(data.moduleFile).not.toContain('-core-core');
  });

  it('manifest sinh ra khai báo family, barrel và moduleFile theo tên thư mục mới', () => {
    const manifest = buildCoreManifest(buildApiCoreData(engineAnswers));
    expect(manifest.family).toBe('customer-claims-core');
    expect(manifest.barrel).toBe('src/v2/core/customer-claims-core/index.ts');
    expect(manifest.moduleFile).toBe('customer-claims-core.module.ts');
  });

  it('mọi thư mục thật trong src/v2/core đều kết thúc bằng -core', async () => {
    const { readdirSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/v2/core');
    const dirs = readdirSync(coreRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs.filter((d) => !d.endsWith('-core'))).toEqual([]);
  });
});
