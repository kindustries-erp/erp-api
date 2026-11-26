import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import { CaseServicesQueryService } from './case-services-query.service';

describe('CaseServicesQueryService', () => {
  let cap: SqlCapture;
  let service: CaseServicesQueryService;
  const listSql = () => cap.calls[cap.calls.length - 1];

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseServicesQueryService(
      cap.dataSource.getRepository(CaseLineGarage),
    );
  });

  it('có chọn chi nhánh ERP thì lọc branch_id, bỏ dòng đã xóa và join chi nhánh đủ account_key', async () => {
    await service.findPage({ branchId: 'b1' });

    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"c"."branch_id" = $1');
      expect(sql).toContain('"c"."external_deleted_at" IS NULL');
      expect(sql).toContain('"c"."is_deleted" = false');
      expect(sql).toContain('"s"."external_deleted_at" IS NULL');
      expect(sql).toContain('"b"."account_key" = "c"."account_key"');
      expect(params[0]).toBe('b1');
    }
  });

  it('không chọn chi nhánh thì không lọc chi nhánh', async () => {
    await service.findPage({});
    for (const { sql } of cap.calls) {
      expect(sql).not.toContain('"c"."branch_id" =');
      expect(sql).not.toContain('"c"."branch_external_id" =');
    }
  });

  it('trang có khóa phụ srv.id, offset và limit; pageSize kẹp ở 200', async () => {
    cap.respond((sql) => (sql.includes('COUNT(') ? [{ total: '450' }] : []));

    const res = await service.findPage({
      branchId: 'b1',
      page: 2,
      pageSize: 999,
    });

    expect(listSql().sql).toMatch(/"s"\."id" ASC LIMIT 200 OFFSET 200$/);
    expect(res.pagination).toMatchObject({
      page: 2,
      pageSize: 200,
      total: 450,
    });
  });

  it('summaries chỉ tính key trong whitelist và dùng cùng thứ tự với trang', async () => {
    const res = await service.findPage({
      branchId: 'b1',
      summaryKeys: 'amountWithTax,khongCo',
    });

    expect(res.summaries).toEqual({
      amountWithTax: { total: 0, pageSubtotal: 0, cumulative: 0 },
      khongCo: null,
    });
    const windowed = cap.calls.find((c) => c.sql.includes('AS "v0"'));
    expect(windowed?.sql).toContain('"s"."id" ASC');
  });

  it('serviceType ALL không lọc; giá trị khác, khoảng ngày và từ khóa thành tham số', async () => {
    await service.findPage({ branchId: 'b1', serviceType: 'ALL' });
    expect(listSql().sql).not.toContain('product_type_code" = ');

    await service.findPage({
      branchId: 'b1',
      serviceType: 'DV',
      from: '2026-08-01',
      to: '2026-08-31',
      search: "x' OR 1=1",
    });
    const { sql, params } = listSql();
    expect(sql).toContain('"s"."product_type_code" = $2');
    expect(sql).toContain('ILIKE');
    expect(sql).not.toContain('OR 1=1');
    expect(params).toEqual(
      expect.arrayContaining([
        'DV',
        // Ranh giới ngày VN (UTC+7): đầu 2026-08-01 và cuối 2026-08-31
        new Date('2026-07-31T17:00:00.000Z'),
        new Date('2026-08-31T16:59:59.999Z'),
        "%x' OR 1=1%",
      ]),
    );
  });

  it('sort lạ bị bỏ qua, rơi về thứ tự mặc định', async () => {
    await service.findPage({
      branchId: 'b1',
      sort: 'drop table,-amountWithTax',
    });
    const { sql } = listSql();
    expect(sql).not.toContain('drop table');
    expect(sql).toContain('"s"."amount_with_tax" DESC');
  });
});
