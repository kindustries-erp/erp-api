import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmployeeManagement } from '../entities/employee-management.entity';
import { EmployeeQueryService } from './employee-query.service';

function build() {
  const qb: Record<string, jest.Mock> = {};
  for (const name of [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'select',
    'skip',
    'take',
  ]) {
    qb[name] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  qb.getOne = jest.fn().mockResolvedValue(null);
  qb.getRawMany = jest.fn().mockResolvedValue([{ code: 'NV-001' }]);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    manager: { query: jest.fn() },
  };
  const service = new EmployeeQueryService(
    repo as unknown as Repository<EmployeeManagement>,
  );
  return { service, repo, qb };
}

describe('EmployeeQueryService', () => {
  it('findAll chỉ đọc dòng chưa xóa mềm, nạp chi nhánh và áp bộ lọc status/branchId', async () => {
    const { service, qb } = build();
    await service.findAll({
      page: 2,
      pageSize: 10,
      status: 'ACTIVE',
      branchId: 'b1',
    } as never);
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('e.branch', 'b');
    expect(qb.where).toHaveBeenCalledWith('e.isDeleted = :isDeleted', {
      isDeleted: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.status = :status', {
      status: 'ACTIVE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.branchId = :branchId', {
      branchId: 'b1',
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('findAll giới hạn pageSize tối đa 200', async () => {
    const { service, qb } = build();
    await service.findAll({ pageSize: 9999 } as never);
    expect(qb.take).toHaveBeenCalledWith(200);
  });

  it('tham số lọc JSON sai trả 400, không bỏ qua im lặng', async () => {
    const { service, qb } = build();
    for (const key of [
      'column_filters',
      'column_search',
      'column_operators',
      'date_ranges',
    ]) {
      await expect(
        service.findAll({ [key]: '{bad' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      service.findColumnOptions('status', undefined, 1, 20, '{bad'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('findAllCodes không lọc xóa mềm để số đã dùng không bị cấp lại', async () => {
    const { service, qb } = build();
    await expect(service.findAllCodes()).resolves.toEqual(['NV-001']);
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('findLinkedUsers không truy vấn khi không có id và khử trùng id', async () => {
    const { service, repo } = build();
    await expect(service.findLinkedUsers(['', ''])).resolves.toEqual(new Map());
    expect(repo.manager.query).not.toHaveBeenCalled();
    repo.manager.query.mockResolvedValue([{ id: 'u1', email: 'a@x.vn' }]);
    const map = await service.findLinkedUsers(['u1', 'u1']);
    expect(repo.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM users_management'),
      [['u1']],
    );
    expect(map.get('u1')).toEqual({ id: 'u1', email: 'a@x.vn' });
  });

  it('findNationalId trả undefined khi không có nhân viên, null khi chưa nhập', async () => {
    const { service, repo } = build();
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.findNationalId('x')).resolves.toBeUndefined();
    repo.findOne.mockResolvedValueOnce({ id: 'e1', nationalId: null });
    await expect(service.findNationalId('e1')).resolves.toBeNull();
  });

  it('findColumnOptions với cột ngoài whitelist (kể cả nationalId) trả trang rỗng', async () => {
    const { service } = build();
    const res = await service.findColumnOptions(
      'nationalId',
      undefined,
      1,
      20,
      undefined,
    );
    expect(res.items).toEqual([]);
  });
});
