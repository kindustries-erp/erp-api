import { Repository } from 'typeorm';
import { BranchManagement } from '@/v2/modules/branches-management/entities/branch-management.entity';
import { ProcurementRequestBranchLinkSource } from './branch.link-source';

describe('ProcurementRequestBranchLinkSource', () => {
  const make = (found: Partial<BranchManagement> | null) => {
    const findOne = jest.fn().mockResolvedValue(found);
    const repo = { findOne } as unknown as Repository<BranchManagement>;
    return { source: new ProcurementRequestBranchLinkSource(repo), findOne };
  };

  it('trả branchName từ tên chi nhánh chưa xóa mềm', async () => {
    const { source, findOne } = make({ id: 'b1', name: 'Chi nhánh 1' });
    await expect(source.findValues('b1')).resolves.toEqual({
      branchName: 'Chi nhánh 1',
    });
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b1', isDeleted: false } }),
    );
  });

  it('trả null khi chi nhánh không tồn tại hoặc đã xóa', async () => {
    const { source } = make(null);
    await expect(source.findValues('zzz')).resolves.toBeNull();
  });

  it('chỉ đọc: không có phương thức ghi', () => {
    const { source } = make(null);
    const methods = Object.getOwnPropertyNames(
      ProcurementRequestBranchLinkSource.prototype,
    );
    expect(methods).toEqual(['constructor', 'findValues']);
    expect(source).toBeDefined();
  });
});
