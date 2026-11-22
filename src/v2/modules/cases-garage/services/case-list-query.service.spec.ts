import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseListQueryService } from './case-list-query.service';

describe('CaseListQueryService', () => {
  let cap: SqlCapture;
  let service: CaseListQueryService;
  const enrichment = {
    settlementSums: jest.fn().mockResolvedValue(new Map()),
    linkCounts: jest.fn().mockResolvedValue(new Map()),
    categoryRefs: jest.fn().mockResolvedValue(new Map()),
    grossProfitByCode: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseListQueryService(
      cap.dataSource.getRepository(CaseGarage),
      enrichment as never,
    );
  });

  it('đọc từ cases_garage, luôn lọc chi nhánh, bỏ xóa mềm v2 và xóa phía KGara', async () => {
    await service.findPage({ branchId: 'b1' });
    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('cases_garage');
      expect(sql).toContain('"c"."branch_external_id" = $1');
      expect(sql).toContain('"c"."is_deleted" = false');
      expect(sql).toContain('"c"."external_deleted_at" IS NULL');
      expect(params[0]).toBe('b1');
    }
  });

  it('includeDeleted bỏ điều kiện xóa phía KGara nhưng vẫn giữ chi nhánh', async () => {
    await service.findPage({ branchId: 'b1', includeDeleted: true });
    for (const { sql } of cap.calls) {
      expect(sql).toContain('"c"."branch_external_id" = $1');
      expect(sql).not.toContain('"c"."external_deleted_at" IS NULL');
    }
  });

  it('lọc theo origin thành tham số', async () => {
    await service.findPage({ branchId: 'b1', origin: 'NATIVE' as never });
    expect(cap.calls[0].sql).toContain('"c"."origin" = $2');
    expect(cap.calls[0].params).toEqual(['b1', 'NATIVE']);
  });

  it('thứ tự có khóa phụ c.id; khoảng ngày và từ khóa thành tham số, không nối chuỗi', async () => {
    await service.findPage({
      branchId: 'b1',
      from: '2026-08-01',
      to: '2026-08-31',
      search: "x' OR 1=1",
    });
    const ordered = cap.calls.filter((c) => c.sql.includes('ORDER BY'));
    expect(ordered.length).toBeGreaterThan(0);
    for (const { sql } of ordered) expect(sql).toContain('"c"."id" ASC');
    expect(cap.calls[0].sql).not.toContain('OR 1=1');
    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining([
        // Đầu ngày 2026-08-01 theo giờ VN (UTC+7)
        new Date('2026-07-31T17:00:00.000Z'),
        "%x' OR 1=1%",
      ]),
    );
  });

  it('sắp xếp theo tên cột EN trong whitelist; key lạ bị bỏ', async () => {
    await service.findPage({
      branchId: 'b1',
      sort: 'drop table,-licensePlate',
    });
    const sqlText = cap.calls.map((c) => c.sql).join('\n');
    expect(sqlText).not.toContain('drop table');
    expect(sqlText).toContain('"c"."license_plate" DESC');
  });

  it('bộ lọc cột xe/payer bằng tên EN; cột VN cũ bị bỏ qua', async () => {
    await service.findPage({
      branchId: 'b1',
      column_filters: JSON.stringify({
        chassisNumber: ['VIN1'],
        payerCode: ['BH1'],
        soKhung: ['VIN1'],
      }),
    });
    const sql = cap.calls[0].sql;
    expect(sql).toContain('"c"."chassis_number"');
    expect(sql).toContain('"c"."payer_code"');
    expect(sql).not.toContain('so_khung');
    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining(['VIN1', 'BH1']),
    );
  });

  it('summaries: key ngoài whitelist trả null', async () => {
    const res = await service.findPage({
      branchId: 'b1',
      summaryKeys: 'revenue,rawData',
    });
    expect(res.summaries.rawData).toBeNull();
    expect(res.summaries.revenue).toEqual({
      total: 0,
      pageSubtotal: 0,
      cumulative: 0,
    });
    expect(res.items).toEqual([]);
  });
});
