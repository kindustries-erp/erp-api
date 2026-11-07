import {
  applyLegacyColumnFilters,
  applyLegacyColumnSearch,
  applyLegacySorts,
  parseLegacyJson,
  paymentStatusCondition,
  toDirection,
} from './legacy-voucher-list.filters';

type Call = { sql: string; params?: Record<string, unknown> };

/** Giả lập tối thiểu SelectQueryBuilder: chỉ ghi lại điều kiện và thứ tự sắp xếp. */
function fakeQb() {
  const wheres: Call[] = [];
  const orders: [string, string][] = [];
  const qb = {
    wheres,
    orders,
    andWhere(sql: unknown, params?: Record<string, unknown>) {
      wheres.push({
        sql: typeof sql === 'string' ? sql : '[brackets]',
        params,
      });
      return qb;
    },
    orderBy(expr?: string, dir?: string) {
      orders.length = 0;
      if (expr) orders.push([expr, dir ?? 'ASC']);
      return qb;
    },
    addOrderBy(expr: string, dir: string) {
      orders.push([expr, dir]);
      return qb;
    },
  };
  return qb;
}

describe('legacy voucher list filters', () => {
  describe('parseLegacyJson', () => {
    it('JSON lỗi hoặc không phải object thì trả object rỗng', () => {
      expect(parseLegacyJson('{abc')).toEqual({});
      expect(parseLegacyJson('[1,2]')).toEqual({});
      expect(parseLegacyJson(undefined)).toEqual({});
    });

    it('JSON object hợp lệ được giữ nguyên', () => {
      expect(parseLegacyJson('{"caseCode":["A"]}')).toEqual({
        caseCode: ['A'],
      });
    });
  });

  describe('toDirection', () => {
    it('ánh xạ RECEIPT/PAYMENT sang IN/OUT, giá trị lạ trả null', () => {
      expect(toDirection('RECEIPT')).toBe('IN');
      expect(toDirection('PAYMENT')).toBe('OUT');
      expect(toDirection('X')).toBeNull();
    });
  });

  describe('paymentStatusCondition', () => {
    it('map nhãn cũ sang trạng thái mới theo chiều', () => {
      expect(paymentStatusCondition('PAID', 'p')).toEqual({
        sql: '(f.status = :p)',
        params: { p: 'SETTLED' },
      });
      expect(paymentStatusCondition('APPROVED', 'p')?.params).toEqual({
        p: ['OPEN', 'PARTIAL'],
      });
      expect(paymentStatusCondition('UNKNOWN', 'p')).toBeNull();
    });
  });

  describe('applyLegacyColumnFilters', () => {
    it('voucherType đổi sang direction', () => {
      const qb = fakeQb();
      applyLegacyColumnFilters(qb as never, '{"voucherType":["PAYMENT"]}');
      expect(qb.wheres).toEqual([
        { sql: 'f.direction IN (:...cf0)', params: { cf0: ['OUT'] } },
      ]);
    });

    it('__BLANK__ đứng riêng thì chỉ lọc giá trị trống', () => {
      const qb = fakeQb();
      applyLegacyColumnFilters(qb as never, '{"caseCode":["__BLANK__"]}');
      expect(qb.wheres[0].sql).toBe(
        "(kc.so_chung_tu IS NULL OR kc.so_chung_tu = '')",
      );
    });

    it('__BLANK__ kèm giá trị thường thì gộp cả hai nhánh, loại __BLANK__ khỏi tham số', () => {
      const qb = fakeQb();
      applyLegacyColumnFilters(
        qb as never,
        '{"paymentContent":["Phí","__BLANK__"]}',
      );
      expect(qb.wheres[0]).toEqual({
        sql: "(ext.payment_content IN (:...cf0) OR ext.payment_content IS NULL OR ext.payment_content = '')",
        params: { cf0: ['Phí'] },
      });
    });

    it('cột không biết và mảng rỗng bị bỏ qua', () => {
      const qb = fakeQb();
      applyLegacyColumnFilters(
        qb as never,
        '{"unknownCol":["x"],"caseCode":[]}',
      );
      expect(qb.wheres).toHaveLength(0);
    });

    it('JSON lỗi không làm hỏng request', () => {
      const qb = fakeQb();
      expect(() => applyLegacyColumnFilters(qb as never, '{bad')).not.toThrow();
      expect(qb.wheres).toHaveLength(0);
    });

    it('khoảng số tiền thu tách theo IN, chi theo OUT', () => {
      const qb = fakeQb();
      applyLegacyColumnFilters(qb as never, '{"chi":["100..200"]}');
      expect(qb.wheres.map((w) => w.sql)).toEqual([
        "f.direction = 'OUT'",
        'f.amount >= :cf0From',
        'f.amount <= :cf0To',
      ]);
      expect(qb.wheres[1].params).toEqual({ cf0From: 100 });
      expect(qb.wheres[2].params).toEqual({ cf0To: 200 });
    });
  });

  describe('applyLegacyColumnSearch', () => {
    it('chỉ tìm trên cột được hỗ trợ, bỏ qua cột lạ và giá trị rỗng', () => {
      const qb = fakeQb();
      applyLegacyColumnSearch(
        qb as never,
        '{"voucherCode":"DC-1;DC-2","unknown":"x","note":""}',
      );
      expect(qb.wheres).toHaveLength(1);
      expect(qb.wheres[0].sql).toBe('[brackets]');
    });
  });

  describe('applyLegacySorts', () => {
    it('không có sắp xếp thì dùng mặc định ngày giao dịch, ngày tạo, mã', () => {
      const qb = fakeQb();
      applyLegacySorts(qb as never, undefined);
      expect(qb.orders).toEqual([
        ['f.plannedDate', 'DESC'],
        ['f.createdAt', 'DESC'],
        ['f.code', 'DESC'],
      ]);
    });

    it('sắp xếp theo "-amount,caseCode" và thêm khóa phụ', () => {
      const qb = fakeQb();
      applyLegacySorts(qb as never, '-amount,caseCode');
      expect(qb.orders).toEqual([
        ['f.amount', 'DESC'],
        ['kc.soChungTu', 'ASC'],
        ['f.createdAt', 'DESC'],
        ['f.code', 'DESC'],
      ]);
    });

    it('cột sắp xếp lạ bị bỏ, không có cột hợp lệ thì về mặc định', () => {
      const qb = fakeQb();
      applyLegacySorts(qb as never, ['-hack', 'x']);
      expect(qb.orders[0]).toEqual(['f.plannedDate', 'DESC']);
    });

    it('voucherType sắp xếp theo biểu thức CASE', () => {
      const qb = fakeQb();
      applyLegacySorts(qb as never, 'voucherType');
      expect(qb.orders[0][1]).toBe('ASC');
      expect(qb.orders[0][0]).toContain("'RECEIPT'");
    });
  });
});
