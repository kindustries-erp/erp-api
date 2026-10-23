import { withImportBranch } from './transaction-import.service';

describe('withImportBranch', () => {
  const dtos = [{ sourceType: 'BANK', amount: 100 } as any];

  it('gán chi nhánh đã chọn cho mọi giao dịch', () => {
    const [dto] = withImportBranch(dtos, 'branch-1');
    expect(dto.branchId).toBe('branch-1');
    expect(dto.branchIds).toEqual(['branch-1']);
  });

  it('không chọn chi nhánh thì giao dịch không có chi nhánh', () => {
    const [dto] = withImportBranch(dtos, undefined);
    expect(dto.branchId).toBeUndefined();
    expect(dto.branchIds).toEqual([]);
  });
});
