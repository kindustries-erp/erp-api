import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CoreUser } from '../../../users/entities/core-user.entity';
import { ApprovalActorService } from './approval-actor.service';

describe('ApprovalActorService', () => {
  let service: ApprovalActorService;
  let getRawMany: jest.Mock;
  let createQueryBuilder: jest.Mock;

  beforeEach(async () => {
    getRawMany = jest.fn();
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany,
    };
    createQueryBuilder = jest.fn().mockReturnValue(qb);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApprovalActorService,
        {
          provide: getRepositoryToken(CoreUser),
          useValue: { createQueryBuilder },
        },
      ],
    }).compile();
    service = moduleRef.get(ApprovalActorService);
  });

  it('danh sách id rỗng thì trả Map rỗng và không truy vấn DB', async () => {
    const result = await service.resolve([]);
    expect(result.size).toBe(0);
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ưu tiên họ tên nhân viên, lấy email từ hồ sơ user', async () => {
    getRawMany.mockResolvedValue([
      { id: 'u1', email: 'a@x.vn', fullName: 'Nguyễn Văn A' },
    ]);
    const result = await service.resolve(['u1']);
    expect(result.get('u1')).toEqual({
      name: 'Nguyễn Văn A',
      email: 'a@x.vn',
    });
  });

  it('user chưa gắn nhân viên thì name = null, vẫn có email', async () => {
    getRawMany.mockResolvedValue([
      { id: 'u2', email: 'b@x.vn', fullName: null },
    ]);
    const result = await service.resolve(['u2']);
    expect(result.get('u2')).toEqual({ name: null, email: 'b@x.vn' });
  });

  it('id không tồn tại không có trong Map; id trùng và rỗng bị bỏ qua', async () => {
    getRawMany.mockResolvedValue([]);
    const result = await service.resolve(['ghost', 'ghost', '', 'ghost']);
    expect(result.has('ghost')).toBe(false);
    expect(result.size).toBe(0);
  });
});
