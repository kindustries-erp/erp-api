import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GarageProcurementOrdersService } from './procurement-orders-garage.service';

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
    { resolve: jest.fn().mockResolvedValue(new Map()) } as never,
    dataSource as never,
    { assertEligible: jest.fn() } as never,
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

function makeUpdateService(
  prBranch: string | null | 'missing',
  poRequestId: string | null,
) {
  const request =
    prBranch === 'missing' ? null : { id: 'pr1', branchId: prBranch };
  const dataSource = {
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(request),
    })),
  };
  const command = {
    updateHeader: jest.fn().mockResolvedValue({}),
  };
  const query = {
    findOne: jest.fn().mockResolvedValue({
      header: { requestId: poRequestId },
      lines: [],
      acceptances: [],
    }),
  };
  const svc = new GarageProcurementOrdersService(
    command as never,
    {} as never,
    query as never,
    { getUserRoleNames: jest.fn().mockResolvedValue([]) } as never,
    { resolve: jest.fn().mockResolvedValue(new Map()) } as never,
    dataSource as never,
    { assertEligible: jest.fn() } as never,
  );
  return { svc, command };
}

describe('GarageProcurementOrdersService - chi nhánh trống', () => {
  it('cho phép tạo khi PR và PO cùng trống chi nhánh', async () => {
    const { svc, command } = makeService(null);
    const emptyDto = {
      orderDate: '2026-11-05',
      requestId: 'pr1',
      lines: [],
    } as never;
    await svc.create(emptyDto, 'u1');
    expect(command.createDraft).toHaveBeenCalled();
  });

  it('từ chối khi PR trống nhưng PO có chi nhánh', async () => {
    const { svc, command } = makeService(null);
    await expect(svc.create(dto, 'u1')).rejects.toThrow(BadRequestException);
    expect(command.createDraft).not.toHaveBeenCalled();
  });

  it('từ chối khi PR có chi nhánh nhưng PO để trống', async () => {
    const { svc, command } = makeService('b1');
    const emptyDto = {
      orderDate: '2026-11-05',
      requestId: 'pr1',
      lines: [],
    } as never;
    await expect(svc.create(emptyDto, 'u1')).rejects.toThrow(
      BadRequestException,
    );
    expect(command.createDraft).not.toHaveBeenCalled();
  });

  it('cho phép bỏ trống chi nhánh PO không gắn PR', async () => {
    const { svc, command } = makeUpdateService('b1', null);
    await svc.updateHeader('o1', { branchId: null } as never);
    expect(command.updateHeader).toHaveBeenCalledWith('o1', {
      branchId: null,
    });
  });

  it('từ chối đổi chi nhánh PO khi PO gắn PR khác chi nhánh', async () => {
    const { svc, command } = makeUpdateService('b1', 'pr1');
    await expect(
      svc.updateHeader('o1', { branchId: 'b2' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(command.updateHeader).not.toHaveBeenCalled();
  });
});

describe('GarageProcurementOrdersService.create - số hóa đơn NCC', () => {
  it('chuyển supplierInvoiceNo vào đầu đơn khi tạo', async () => {
    const { svc, command } = makeService('b1');
    await svc.create(
      {
        orderDate: '2026-11-05',
        supplierInvoiceNo: 'HD-0001',
        lines: [],
      } as never,
      'u1',
    );
    expect(command.createDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ supplierInvoiceNo: 'HD-0001' }),
      [],
    );
  });
});
