import { BranchesManagementService } from '../branches-management.service';
import { ErpBranchController } from './erp-branch.controller';

describe('ErpBranchController', () => {
  let service: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let controller: ErpBranchController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new ErpBranchController(
      service as unknown as BranchesManagementService,
    );
  });

  it('delegates the list query to the facade', async () => {
    const query = { page: 1, search: 'HN' };

    await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates create, update and hard delete without changing the body', async () => {
    const body = { is_active: false, extra: 1 };

    await controller.create(body);
    await controller.update('id-1', body);
    await controller.remove('id-1');

    expect(service.create).toHaveBeenCalledWith(body);
    expect(service.update).toHaveBeenCalledWith('id-1', body);
    expect(service.remove).toHaveBeenCalledWith('id-1');
  });
});
