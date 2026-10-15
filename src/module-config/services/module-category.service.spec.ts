import { ConflictException } from '@nestjs/common';
import { ModuleCategoryService } from './module-category.service';

describe('ModuleCategoryService.deleteCategory', () => {
  const build = (category: any, queryRows: any[] = [{ count: 0 }]) => {
    const categoryRepo: any = {
      findOne: jest.fn().mockResolvedValue(category),
      save: jest.fn(),
    };
    const dataSource: any = { query: jest.fn().mockResolvedValue(queryRows) };
    const service = new ModuleCategoryService(
      categoryRepo,
      { update: jest.fn() } as any,
      { count: jest.fn().mockResolvedValue(0) } as any,
      dataSource,
    );
    return { service, categoryRepo, dataSource };
  };

  it('chặn xóa category có semanticKey', async () => {
    const { service, categoryRepo, dataSource } = build({
      id: 'c1',
      code: 'OJ',
      semanticKey: 'OJ',
      attributeDefs: [],
    });
    await expect(service.deleteCategory('c1')).rejects.toThrow(
      ConflictException,
    );
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('chặn xóa category đang được vụ việc Garage dùng', async () => {
    const { service, categoryRepo } = build(
      { id: 'c2', code: 'X', semanticKey: null, attributeDefs: [] },
      [{ count: 3 }],
    );
    await expect(service.deleteCategory('c2')).rejects.toThrow(
      /vụ việc Garage/,
    );
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('xóa mềm khi không bị tham chiếu', async () => {
    const { service, categoryRepo } = build({
      id: 'c3',
      code: 'Y',
      semanticKey: null,
      attributeDefs: [],
    });
    await service.deleteCategory('c3');
    expect(categoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true }),
    );
  });
});
