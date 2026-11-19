import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { CaseListEnrichmentService } from './case-list-enrichment.service';

describe('CaseListEnrichmentService', () => {
  let cap: SqlCapture;
  let service: CaseListEnrichmentService;

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseListEnrichmentService(
      cap.dataSource.getRepository(KgaraCaseSettlement),
      cap.dataSource.getRepository(KgaraCaseLinkedInvoice),
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
});
