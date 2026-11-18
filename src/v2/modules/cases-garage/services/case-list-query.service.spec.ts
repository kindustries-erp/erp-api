import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CaseListQueryService } from './case-list-query.service';

describe('CaseListQueryService', () => {
  let cap: SqlCapture;
  let service: CaseListQueryService;
  const enrichment = {
    settlementSums: jest.fn().mockResolvedValue(new Map()),
    linkCounts: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseListQueryService(
      cap.dataSource.getRepository(KgaraCase),
      enrichment as never,
    );
  });

  it('luôn lọc chi nhánh và bỏ vụ việc đã xóa mềm', async () => {
    await service.findPage({ branchId: 'b1' });

    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"case"."branch_external_id" = $1');
      expect(sql).toContain('"case"."kgara_deleted_at" IS NULL');
      expect(params[0]).toBe('b1');
    }
  });

  it('includeDeleted bỏ điều kiện xóa mềm nhưng vẫn giữ chi nhánh', async () => {
    await service.findPage({ branchId: 'b1', includeDeleted: true });

    for (const { sql } of cap.calls) {
      expect(sql).toContain('"case"."branch_external_id" = $1');
      expect(sql).not.toContain('"case"."kgara_deleted_at" IS NULL');
    }
  });

  it('thứ tự có khóa phụ case.id; khoảng ngày thành tham số', async () => {
    await service.findPage({
      branchId: 'b1',
      from: '2026-08-01',
      to: '2026-08-31',
    });

    const ordered = cap.calls.filter((c) => c.sql.includes('ORDER BY'));
    expect(ordered.length).toBeGreaterThan(0);
    for (const { sql } of ordered) expect(sql).toMatch(/"case"\."id"|case_id/);
    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining(['2026-08-01 00:00:00']),
    );
  });

  it('summaries: key ngoài whitelist trả null', async () => {
    const res = await service.findPage({
      branchId: 'b1',
      summaryKeys: 'doanhThu,rawData',
    });

    expect(res.summaries.rawData).toBeNull();
    expect(res.summaries.doanhThu).toEqual({
      total: 0,
      pageSubtotal: 0,
      cumulative: 0,
    });
    expect(res.items).toEqual([]);
  });
});
