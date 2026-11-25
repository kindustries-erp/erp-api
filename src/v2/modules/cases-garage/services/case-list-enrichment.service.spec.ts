import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import {
  CaseListEnrichmentService,
  grossProfitKey,
} from './case-list-enrichment.service';

describe('CaseListEnrichmentService', () => {
  let cap: SqlCapture;
  let service: CaseListEnrichmentService;

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseListEnrichmentService(
      cap.dataSource.getRepository(KgaraCaseSettlement),
      cap.dataSource.getRepository(KgaraCaseLinkedInvoice),
      cap.dataSource.getRepository(ErpModuleCategory),
      cap.dataSource.getRepository(KgaraGrossProfit),
    );
  });

  it('trang rỗng thì không chạy truy vấn nào', async () => {
    expect((await service.settlementSums([])).size).toBe(0);
    expect((await service.linkCounts([])).size).toBe(0);
    expect(cap.calls).toHaveLength(0);
  });

  it('gộp RECEIPT và PAYMENT theo vụ việc bằng một truy vấn', async () => {
    cap.respond(() => [
      { caseId: 'c1', type: 'RECEIPT', amount: '100.50' },
      { caseId: 'c1', type: 'PAYMENT', amount: '40' },
      { caseId: 'c2', type: 'RECEIPT', amount: '7' },
      { caseId: 'c2', type: 'KHAC', amount: '999' },
    ]);

    const sums = await service.settlementSums(['c1', 'c2']);

    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0].params).toEqual(['c1', 'c2']);
    expect(sums.get('c1')).toEqual({
      receipts: 100.5,
      payments: 40,
      hasReceipt: true,
    });
    expect(sums.get('c2')).toEqual({
      receipts: 7,
      payments: 0,
      hasReceipt: true,
    });
  });

  it('đếm hóa đơn liên kết theo chiều OUT và IN', async () => {
    cap.respond(() => [
      { caseId: 'c1', total: '3', outCount: '2', inCount: '1' },
    ]);

    const links = await service.linkCounts(['c1']);

    expect(cap.calls).toHaveLength(1);
    expect(links.get('c1')).toEqual({ total: 3, outCount: 2, inCount: 1 });
    expect(links.get('c2')).toBeUndefined();
  });

  it('categoryRefs: bỏ id rỗng/trùng, trang rỗng không truy vấn', async () => {
    expect((await service.categoryRefs([null])).size).toBe(0);
    expect(cap.calls).toHaveLength(0);
    cap.respond(() => [
      {
        ErpModuleCategory_id: 'k1',
        ErpModuleCategory_code: 'SC',
        ErpModuleCategory_name: 'Sửa chữa',
      },
    ]);
    await service.categoryRefs(['k1', 'k1', null]);
    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0].params).toEqual(['k1']);
  });

  it('grossProfitByCase: khớp mã + đơn vị KGara của vụ việc, không truy vấn khi rỗng', async () => {
    expect((await service.grossProfitByCase([])).size).toBe(0);
    expect(cap.calls).toHaveLength(0);
    await service.grossProfitByCase([
      { caseCode: 'PS1', branchExternalId: 'KG1' },
      { caseCode: 'PS1', branchExternalId: 'KG1' },
    ]);
    expect(cap.calls[0].params).toEqual(['PS1']);
  });

  it('grossProfitByCase: hai đơn vị KGara trùng mã không đè nhau; đơn vị không yêu cầu bị bỏ', async () => {
    const gp = (ext: string, doanhThu: number) => ({
      vuViecCode: 'VV1',
      branchExternalId: ext,
      doanhThu,
      chiPhi: 0,
      loiNhuan: doanhThu,
    });
    const find = jest
      .fn()
      .mockResolvedValue([gp('KG1', 100), gp('KG2', 200), gp('KG3', 300)]);
    const svc = new CaseListEnrichmentService(
      {} as never,
      {} as never,
      {} as never,
      { find } as never,
    );
    const map = await svc.grossProfitByCase([
      { caseCode: 'VV1', branchExternalId: 'KG1' },
      { caseCode: 'VV1', branchExternalId: 'KG2' },
    ]);
    expect(map.size).toBe(2);
    expect(map.get(grossProfitKey('VV1', 'KG1'))?.revenue).toBe(100);
    expect(map.get(grossProfitKey('VV1', 'KG2'))?.revenue).toBe(200);
  });
});
