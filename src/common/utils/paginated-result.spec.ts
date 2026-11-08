import { buildPagination, toPaginatedResult } from './paginated-result';

describe('paginated-result', () => {
  describe('buildPagination', () => {
    it('tính totalPages bằng trần của total / pageSize', () => {
      expect(buildPagination(1, 20, 125)).toEqual({
        page: 1,
        pageSize: 20,
        total: 125,
        totalPages: 7,
      });
    });

    it('totalPages bằng 1 khi không có dòng nào', () => {
      expect(buildPagination(1, 20, 0).totalPages).toBe(1);
    });

    it('totalPages đúng khi total chia hết pageSize', () => {
      expect(buildPagination(2, 10, 40).totalPages).toBe(4);
    });

    it('không chia cho 0 khi pageSize không hợp lệ', () => {
      expect(buildPagination(1, 0, 5).totalPages).toBe(5);
    });
  });

  describe('toPaginatedResult', () => {
    it('trả đúng shape items, pagination, summaries', () => {
      const out = toPaginatedResult([{ id: 'a' }], 1, 20, 1, {
        estimatedTotal: 450000,
      });
      expect(out).toEqual({
        items: [{ id: 'a' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        summaries: { estimatedTotal: 450000 },
      });
    });

    it('summaries mặc định là object rỗng, không bỏ key', () => {
      const out = toPaginatedResult([], 1, 20, 0);
      expect(out.summaries).toEqual({});
      expect(out).toHaveProperty('summaries');
    });

    it('không còn key phẳng rows/total/page/pageSize ở top level', () => {
      const out = toPaginatedResult([], 1, 20, 0);
      expect(out).not.toHaveProperty('rows');
      expect(out).not.toHaveProperty('total');
      expect(out).not.toHaveProperty('page');
      expect(out).not.toHaveProperty('pageSize');
    });
  });
});
