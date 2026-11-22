import { BadRequestException } from '@nestjs/common';
import { ApproverDirectoryService } from './approver-directory.service';

function build(ids: string[], users: Array<{ id: string; email: string }>) {
  const rbac = {
    findUserIdsWithPermissions: jest.fn().mockResolvedValue(ids),
  };
  const repo = {
    find: jest.fn().mockResolvedValue(users),
  };
  const svc = new ApproverDirectoryService(rbac as never, repo as never);
  return { svc, rbac, repo };
}

describe('ApproverDirectoryService', () => {
  it('hỏi RBAC với đúng hai quyền APPROVE và REJECT', async () => {
    const { svc, rbac } = build([], []);
    await svc.listApprovers('garage_procurement_requests');
    expect(rbac.findUserIdsWithPermissions).toHaveBeenCalledWith(
      'garage_procurement_requests',
      ['approve', 'reject'],
    );
  });

  it('loại người gọi khỏi danh sách', async () => {
    const { svc, repo } = build(['u1', 'u2'], [{ id: 'u2', email: 'b@x' }]);
    const out = await svc.listApprovers('garage_procurement_requests', 'u1');
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(out).toEqual([{ id: 'u2', email: 'b@x' }]);
  });

  it('không truy vấn user khi không còn ứng viên', async () => {
    const { svc, repo } = build(['u1'], []);
    expect(await svc.listApprovers('x', 'u1')).toEqual([]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('assertEligible: người không có quyền duyệt bị 400', async () => {
    const { svc } = build(['u2'], [{ id: 'u2', email: 'b@x' }]);
    await expect(svc.assertEligible('x', 'u9', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.assertEligible('x', 'u2', 'u1')).resolves.toBeUndefined();
  });
});
