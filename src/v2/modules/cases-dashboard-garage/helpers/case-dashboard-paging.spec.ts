import { normalizePaging } from './case-dashboard-paging';

describe('normalizePaging', () => {
  it('kẹp cỡ trang và trang về giá trị an toàn', () => {
    expect(normalizePaging(0, 500)).toEqual({ page: 1, pageSize: 100 });
    expect(normalizePaging(-3, 0)).toEqual({ page: 1, pageSize: 1 });
    expect(normalizePaging(NaN, NaN)).toEqual({ page: 1, pageSize: 20 });
    expect(normalizePaging(2, 50)).toEqual({ page: 2, pageSize: 50 });
  });

  it('làm tròn xuống số thập phân', () => {
    expect(normalizePaging(2.9, 10.7)).toEqual({ page: 2, pageSize: 10 });
  });
});
