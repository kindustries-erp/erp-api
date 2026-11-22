import { BadRequestException } from '@nestjs/common';
import {
  buildUnionSourceSql,
  buildVoucherOrder,
  buildVoucherWhere,
  escapeLike,
  parseColumnFilters,
} from './stock-voucher-union-sql.helper';

const columns = {
  id: 'id',
  voucherNo: 'voucher_no',
  voucherDate: 'voucher_date',
  status: 'status',
  partnerName: 'partner_name',
  branchId: 'branch_id',
  totalAmount: 'total_amount',
  remarks: 'remarks',
  createdAt: 'created_at',
};

describe('stock-voucher-union-sql helper', () => {
  describe('buildUnionSourceSql', () => {
    it('chuẩn hóa nguồn về cùng bộ cột và loại hằng', () => {
      const sql = buildUnionSourceSql({
        type: 'ISSUE',
        table: 'garage_stock_issues',
        columns,
      });
      expect(sql).toContain(`'ISSUE'::text AS "type"`);
      expect(sql).toContain(
        `FROM "garage_stock_issues" t WHERE t."is_deleted" = false`,
      );
    });

    it('từ chối mã loại hoặc định danh không hợp lệ', () => {
      expect(() =>
        buildUnionSourceSql({ type: 'issue', table: 't', columns }),
      ).toThrow('Mã loại không hợp lệ');
      expect(() =>
        buildUnionSourceSql({ type: 'ISSUE', table: 'bad name', columns }),
      ).toThrow('Định danh không hợp lệ');
    });
  });

  describe('buildVoucherOrder', () => {
    it('dùng mặc định khi sort rỗng hoặc toàn cột lạ', () => {
      expect(buildVoucherOrder(undefined)).toBe(
        'u."voucherDate" DESC, u."voucherNo" DESC, u."id" ASC',
      );
      expect(buildVoucherOrder('bad,drop;table')).toBe(
        'u."voucherDate" DESC, u."voucherNo" DESC, u."id" ASC',
      );
    });

    it('chỉ nhận cột trong whitelist, có hướng giảm dần với tiền tố -', () => {
      expect(buildVoucherOrder('-totalAmount,status')).toBe(
        'u."totalAmount" DESC, u."status" ASC, u."voucherNo" DESC, u."id" ASC',
      );
    });
  });

  describe('parseColumnFilters', () => {
    it('bỏ cột không được lọc và chuẩn hóa giá trị thành chuỗi', () => {
      expect(
        parseColumnFilters(
          JSON.stringify({ type: ['ISSUE', 2], hack: ['x'], status: 'POSTED' }),
        ),
      ).toEqual({ type: ['ISSUE', '2'], status: ['POSTED'] });
    });

    it('báo lỗi khi JSON sai hoặc không phải object', () => {
      expect(() => parseColumnFilters('{bad')).toThrow(BadRequestException);
      expect(() => parseColumnFilters('[1]')).toThrow(BadRequestException);
    });

    it('trả về rỗng khi không có tham số', () => {
      expect(parseColumnFilters(undefined)).toEqual({});
    });
  });

  describe('buildVoucherWhere', () => {
    const types = ['PURCHASE_RECEIPT', 'ISSUE'];

    it('dựng điều kiện có tham số hóa và bỏ cột đang loại trừ', () => {
      const where = buildVoucherWhere(
        {
          type: 'ISSUE',
          status: 'POSTED',
          search: 'a%',
          column_filters: JSON.stringify({ partnerName: ['ACME'] }),
        },
        types,
        'status',
      );
      expect(where.sql).toContain('u."type" = $1');
      expect(where.sql).not.toContain('u."status"');
      expect(where.sql).toContain('u."partnerName" = ANY($');
      expect(where.params[0]).toBe('ISSUE');
      expect(where.params).toContain('%a\\%%');
    });

    it('bỏ điều kiện loại khi exclude là type (đếm badge theo loại)', () => {
      const where = buildVoucherWhere({ type: 'ISSUE' }, types, 'type');
      expect(where).toEqual({ sql: '', params: [] });
    });

    it('từ chối loại phiếu không khai báo', () => {
      expect(() => buildVoucherWhere({ type: 'NOPE' }, types)).toThrow(
        BadRequestException,
      );
    });
  });

  it('escapeLike thoát ký tự đặc biệt của LIKE', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
