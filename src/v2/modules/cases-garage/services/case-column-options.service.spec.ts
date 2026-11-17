import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import appDataSource from '@/db/data-source';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CaseColumnOptionsService } from './case-column-options.service';

describe('CaseColumnOptionsService', () => {
  let cap: SqlCapture;
  let service: CaseColumnOptionsService;

  beforeEach(async () => {
    cap = await createSqlCapture(appDataSource.options.entities as never[]);
    service = new CaseColumnOptionsService(
      cap.dataSource.getRepository(KgaraCase),
    );
  });

  it('cột ngoài whitelist trả trang rỗng, không chạy truy vấn', async () => {
    const res = await service.findOptions('b1', 'raw_data; drop', {});

    expect(res.items).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(cap.calls).toHaveLength(0);
  });

  it('cột hợp lệ: DISTINCT trong chi nhánh, bỏ vụ việc đã xóa, từ khóa thành tham số', async () => {
    cap.respond((sql) =>
      sql.includes('COUNT(DISTINCT')
        ? [{ cnt: '2' }]
        : [{ value: '51A-1' }, { value: '51A-2' }],
    );

    const res = await service.findOptions('b1', 'bienSoXe', {
      search: "51' --",
      pageSize: 999,
    });

    expect(res.items).toEqual([
      { label: '51A-1', value: '51A-1' },
      { label: '51A-2', value: '51A-2' },
    ]);
    expect(res.pagination).toMatchObject({ pageSize: 200, total: 2 });
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"case"."branch_external_id" = $1');
      expect(sql).toContain('"case"."kgara_deleted_at" IS NULL');
      expect(sql).not.toContain("51' --");
      expect(params[0]).toBe('b1');
    }
  });
});
