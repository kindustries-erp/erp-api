import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GarageProcurementOrdersService } from './garage-procurement-orders.service';

function makeService(requestBranch: string | null | 'missing') {
  const request =
    requestBranch === 'missing' ? null : { id: 'pr1', branchId: requestBranch };
  const dataSource = {
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(request),
    })),
    transaction: jest.fn(),
  };
  const command = {
    createDraft: jest.fn().mockResolvedValue({ id: 'o1' }),
  };
  const query = {
    findOne: jest
      .fn()
      .mockResolvedValue({ header: {}, lines: [], acceptances: [] }),
  };
  const rbac = { getUserRoleNames: jest.fn().mockResolvedValue([]) };
  const svc = new GarageProcurementOrdersService(
    command as never,
    {} as never,
    query as never,
    rbac as never,
    dataSource as never,
  );
  return { svc, command };
}

const dto = {
  branchId: 'b1',
  orderDate: '2026-11-05',
  requestId: 'pr1',
  lines: [],
} as never;

describe('GarageProcurementOrdersService.create - đối chiếu chi nhánh PR', () => {
  it('từ chối khi PR khác chi nhánh và không tạo đơn', async () => {
    const { svc, command } = makeService('b2');
    await expect(svc.create(dto, 'u1')).rejects.toThrow(BadRequestException);
    expect(command.createDraft).not.toHaveBeenCalled();
  });

  it('từ chối khi PR không tồn tại', async () => {
    const { svc, command } = makeService('missing');
    await expect(svc.create(dto, 'u1')).rejects.toThrow(NotFoundException);
    expect(command.createDraft).not.toHaveBeenCalled();
  });

  it('cho phép tạo khi PR cùng chi nhánh', async () => {
    const { svc, command } = makeService('b1');
    await svc.create(dto, 'u1');
    expect(command.createDraft).toHaveBeenCalled();
  });
});
