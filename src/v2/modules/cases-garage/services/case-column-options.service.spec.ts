import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseColumnOptionsService } from './case-column-options.service';
import { CaseListQueryService } from './case-list-query.service';

describe('CaseColumnOptionsService', () => {
  let cap: SqlCapture;
  let service: CaseColumnOptionsService;

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    const list = new CaseListQueryService(
      cap.dataSource.getRepository(CaseGarage),
      {} as never,
    );
    service = new CaseColumnOptionsService(list);
  });

  it('cột ngoài whitelist trả trang rỗng, không chạy truy vấn', async () => {
    const res = await service.findOptions('b1', 'raw_data; drop', {});
    expect(res.items).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(cap.calls).toHaveLength(0);
  });

  it('cột EN hợp lệ: DISTINCT trong chi nhánh, bỏ vụ việc đã xóa, từ khóa thành tham số', async () => {
    cap.respond((sql) =>
      sql.includes('COUNT(DISTINCT')
        ? [{ total: '2' }]
        : [{ value: '51A-1' }, { value: '51A-2' }],
    );
    const res = await service.findOptions('b1', 'licensePlate', {
      search: "51' --",
      pageSize: 999,
    });
    expect(res.items).toEqual([
      { label: '51A-1', value: '51A-1' },
      { label: '51A-2', value: '51A-2' },
    ]);
    expect(res.pagination).toMatchObject({ pageSize: 200, total: 2 });
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"c"."branch_id" = $1');
      expect(sql).toContain('"c"."external_deleted_at" IS NULL');
      expect(sql).not.toContain("51' --");
      expect(params[0]).toBe('b1');
    }
  });
});
