import {
  buildPagination,
  toPagedList,
  toPaginatedResult,
} from './paginated-result';

describe('paginated-result', () => {
  describe('buildPagination', () => {
    it('tính totalPages bằng trần của total / pageSize', () => {
      expect(buildPagination(1, 20, 125)).toEqual({
        page: 1,
        pageSize: 20,
        total: 125,
        totalPages: 7,
        next: 2,
        previous: null,
      });
    });

    it('trang giữa có cả next và previous', () => {
      expect(buildPagination(3, 10, 50)).toMatchObject({
        next: 4,
        previous: 2,
      });
    });

    it('trang cuối: next là null', () => {
      expect(buildPagination(4, 10, 40)).toMatchObject({
        next: null,
        previous: 3,
      });
    });

    it('không có dòng: next và previous đều null', () => {
      expect(buildPagination(1, 20, 0)).toMatchObject({
        next: null,
        previous: null,
      });
    });

    it('page vượt quá số trang: previous kẹp về trang cuối', () => {
      expect(buildPagination(9, 10, 40)).toMatchObject({
        next: null,
        previous: 4,
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
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          next: null,
          previous: null,
        },
        summaries: { estimatedTotal: 450000 },
      });
    });

    it('toPagedList trả items và pagination, không có summaries', () => {
      const out = toPagedList([{ id: 'a' }], 1, 20, 1);
      expect(out).toEqual({
        items: [{ id: 'a' }],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          next: null,
          previous: null,
        },
      });
      expect(out).not.toHaveProperty('summaries');
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

describe('extraData tùy chọn', () => {
  it('toPagedList không có extraData khi không truyền', () => {
    const res = toPagedList([1], 1, 20, 1);
    expect(res).not.toHaveProperty('extraData');
  });

  it('toPagedList gắn extraData khi truyền', () => {
    const res = toPagedList([1], 1, 20, 1, { unreadCount: 3 });
    expect(res.extraData).toEqual({ unreadCount: 3 });
    expect(res.pagination.total).toBe(1);
  });

  it('toPaginatedResult chỉ thêm extraData khi truyền', () => {
    expect(toPaginatedResult([1], 1, 20, 1)).not.toHaveProperty('extraData');
    expect(
      toPaginatedResult([1], 1, 20, 1, {}, { unreadCount: 2 }).extraData,
    ).toEqual({ unreadCount: 2 });
  });
});
