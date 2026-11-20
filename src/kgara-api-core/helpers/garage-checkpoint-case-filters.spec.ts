import {
  applyCheckpointCaseFilters,
  type CheckpointCaseFilters,
} from './garage-checkpoint-case-filters';

const BASE: CheckpointCaseFilters = {
  dateFrom: '2026-11-01',
  effectiveDateTo: '2026-11-30 23:59:59.999',
  isFunnelMode: false,
};

function run(over: Partial<CheckpointCaseFilters>) {
  const wheres: string[] = [];
  const params: Array<Record<string, unknown>> = [];
  const qb: any = {
    andWhere: jest.fn((cond: string, p?: Record<string, unknown>) => {
      wheres.push(cond);
      if (p) params.push(p);
      return qb;
    }),
  };
  applyCheckpointCaseFilters(qb, { ...BASE, ...over });
  return { sql: wheres.join(' AND '), params };
}

describe('applyCheckpointCaseFilters', () => {
  it('chế độ thường: chỉ phiếu hoàn thành, không hủy, theo ngày hoàn thành', () => {
    const { sql, params } = run({});

    expect(sql).toContain('c.ngay_hoan_thanh_cong_viec IS NOT NULL');
    expect(sql).toContain('c.ngay_hoan_thanh_cong_viec >= :dateFrom');
    expect(sql).toContain('c.tinh_trang_dich_vu != 9');
    expect(params).toContainEqual({ dateFrom: '2026-11-01' });
    expect(params).toContainEqual({ dateTo: '2026-11-30 23:59:59.999' });
  });

  it('chế độ phễu: lọc theo mốc kỳ COALESCE(hoàn thành, phát sinh, tạo)', () => {
    const { sql } = run({ isFunnelMode: true });

    expect(sql).toContain(
      'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :dateFrom',
    );
    expect(sql).not.toContain('c.ngay_hoan_thanh_cong_viec IS NOT NULL AND');
  });

  it.each([
    ['quotation', '(c.ngay_hoan_thanh_cong_viec IS NULL AND'],
    ['in_progress', 'AND NOT ('],
    ['completed', '(c.ngay_hoan_thanh_cong_viec IS NOT NULL AND'],
    ['cancelled', 'c.tinh_trang_dich_vu = 9'],
  ])(
    'chế độ phễu với status %s thêm điều kiện giai đoạn',
    (status, expected) => {
      const withStatus = run({ isFunnelMode: true, status }).sql;
      const without = run({ isFunnelMode: true }).sql;

      expect(withStatus.length).toBeGreaterThan(without.length);
      expect(withStatus).toContain(expected);
      expect(without).not.toContain(expected);
    },
  );

  it('chế độ thường bỏ qua status (chỉ phễu mới lọc giai đoạn)', () => {
    expect(run({ status: 'cancelled' }).sql).not.toContain(
      'c.tinh_trang_dich_vu = 9',
    );
  });

  it('search, tiến độ nợ và phân loại được thêm khi có tham số', () => {
    const { sql, params } = run({
      search: ' 51b ',
      paymentStatus: 'remaining',
      classification: 'OJ_NGOAI',
    });

    expect(sql).toContain('c.bien_so_xe ILIKE :search');
    expect(params).toContainEqual({ search: '%51b%', searchPlate: '%51B%' });
    expect(sql).toContain('LIKE :searchPlate');
    expect(sql).toContain('COALESCE(c.tien_con_phai_thanh_toan, 0) > 0');
    expect(sql).toContain("IN ('OJ', 'OJ_NGOAI')");
  });

  it('search biển số chuẩn hóa: bỏ dấu gạch/chấm, hoa thường', () => {
    const { params } = run({ search: '51b-756.95' });

    expect(params).toContainEqual({
      search: '%51b-756.95%',
      searchPlate: '%51B75695%',
    });
  });

  it('search chỉ gồm ký tự rác thì không thêm điều kiện biển chuẩn hóa', () => {
    const { sql, params } = run({ search: '..-' });

    expect(sql).not.toContain(':searchPlate');
    expect(params).toContainEqual({ search: '%..-%' });
  });

  it('không thêm điều kiện phân loại khi ALL hoặc mã lạ', () => {
    expect(run({ classification: 'ALL' }).sql).not.toContain('cat.code');
    expect(run({ classification: 'LẠ' }).sql).not.toContain('cat.code');
  });
});
