import { NotFoundException } from '@nestjs/common';
import { FileOwnerType } from '@/v2/core/file-attachments-core';
import { FileAttachmentQueryService } from './file-attachment-query.service';

function fakeQb(result: [unknown[], number] = [[], 0]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue(result);
  return qb;
}

function setup(qb = fakeQb()) {
  const repo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(3),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  return { service: new FileAttachmentQueryService(repo as never), repo, qb };
}

describe('FileAttachmentQueryService', () => {
  it('listByOwner luôn khóa owner và chỉ lấy file chưa xóa', async () => {
    const { service, repo } = setup();
    await service.listByOwner(FileOwnerType.INVOICE, 'inv-1');
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerType: 'INVOICE', ownerId: 'inv-1', isDeleted: false },
      }),
    );
  });

  it('getForOwner khóa cả id, owner, chưa xóa; không thấy thì 404', async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.getForOwner(FileOwnerType.INVOICE, 'inv-1', 'a1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        id: 'a1',
        ownerType: 'INVOICE',
        ownerId: 'inv-1',
        isDeleted: false,
      },
    });
  });

  it('getById tìm cả file đã xóa mềm', async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValue({ id: 'a1', isDeleted: true });
    await expect(service.getById('a1')).resolves.toMatchObject({ id: 'a1' });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });

  it('findAll mặc định chỉ lấy chưa xóa, sắp xếp createdAt', async () => {
    const { service, qb } = setup();
    await service.findAll({ page: 1, pageSize: 20 });
    expect(qb.where).toHaveBeenCalledWith('f.isDeleted = :isDeleted', {
      isDeleted: false,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('f.createdAt', 'DESC');
  });

  it('findAll deleted=only chỉ lấy đã xóa, sắp xếp deletedAt', async () => {
    const { service, qb } = setup();
    await service.findAll({ deleted: 'only' });
    expect(qb.where).toHaveBeenCalledWith('f.isDeleted = :isDeleted', {
      isDeleted: true,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('f.deletedAt', 'DESC');
  });

  it('findAll áp bộ lọc owner, nhóm, nguồn và phân trang', async () => {
    const { service, qb } = setup(fakeQb([[{ id: 'x' }], 41]));
    const out = await service.findAll({
      ownerType: 'INVOICE',
      category: 'HOA_DON',
      origin: 'LEGACY',
      page: 3,
      pageSize: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('f.ownerType = :ownerType', {
      ownerType: 'INVOICE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('f.origin = :origin', {
      origin: 'LEGACY',
    });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(out).toMatchObject({ total: 41, page: 3, pageSize: 10 });
  });

  it('findColumnOptions với cột ngoài whitelist trả trang rỗng', async () => {
    const { service, repo } = setup();
    const out = await service.findColumnOptions(
      'fileKey',
      undefined,
      1,
      20,
      {},
    );
    expect(out.items).toEqual([]);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
