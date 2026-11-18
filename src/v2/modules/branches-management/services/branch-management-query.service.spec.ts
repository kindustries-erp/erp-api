import { BranchManagementQueryService } from './branch-management-query.service';

describe('BranchManagementQueryService', () => {
  it('đọc từ repository của BranchManagement, chỉ bản ghi chưa xóa mềm', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const service = new BranchManagementQueryService({ findAndCount } as never);
    await service.findAll({});
    expect(findAndCount.mock.calls[0][0].where).toEqual([{ isDeleted: false }]);
  });
});
