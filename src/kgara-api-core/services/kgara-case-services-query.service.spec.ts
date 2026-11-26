import {
  CASE_SERVICES_EXPORT_MAX_ROWS,
  CASE_SERVICES_PAGE_SIZE_MAX,
  resolveCaseServicesPageSize,
} from './kgara-case-services-query.service';

describe('resolveCaseServicesPageSize', () => {
  it('API phân trang: mặc định 20, tối thiểu 1, tối đa 100', () => {
    expect(resolveCaseServicesPageSize(undefined)).toBe(20);
    expect(resolveCaseServicesPageSize('abc')).toBe(20);
    expect(resolveCaseServicesPageSize(-5)).toBe(1);
    expect(resolveCaseServicesPageSize('50')).toBe(50);
    expect(resolveCaseServicesPageSize(50000)).toBe(
      CASE_SERVICES_PAGE_SIZE_MAX,
    );
  });

  it('export truyền trần riêng thì lấy đủ dòng tới trần export', () => {
    expect(
      resolveCaseServicesPageSize(50000, CASE_SERVICES_EXPORT_MAX_ROWS),
    ).toBe(50000);
    expect(
      resolveCaseServicesPageSize(90000, CASE_SERVICES_EXPORT_MAX_ROWS),
    ).toBe(CASE_SERVICES_EXPORT_MAX_ROWS);
  });
});
