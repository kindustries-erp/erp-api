import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { LoansController } from './loans.controller';
import { LoansService } from '../loans.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';

describe('LoansController', () => {
  let controller: LoansController;
  let service: any;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          next: null,
          previous: null,
        },
        summaries: {},
      }),
      findColumnOptions: jest.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          next: null,
          previous: null,
        },
      }),
      findOne: jest.fn().mockResolvedValue({ id: 'l1', title: 'Car Loan' }),
      create: jest.fn().mockResolvedValue({ id: 'l1', title: 'Car Loan' }),
      update: jest.fn().mockResolvedValue({ id: 'l1', title: 'Updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
      hardDelete: jest.fn().mockResolvedValue({ id: 'l1' }),
      recordPayment: jest.fn().mockResolvedValue({ id: 'l1' }),
      getCashflowProjection: jest
        .fn()
        .mockResolvedValue({ monthlyProjections: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [{ provide: LoansService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LoansController>(LoansController);
  });

  it('should call findAll and return V2 pagination + summaries', async () => {
    const q = { page: 1, pageSize: 20 };
    const res = await controller.findAll(q);
    expect(service.findAll).toHaveBeenCalledWith(q, undefined);
    expect(res.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      next: null,
      previous: null,
    });
    expect(res.summaries).toEqual({});
  });

  it('should clamp columnOptions params and forward deleted=only', async () => {
    await controller.columnOptions(
      'lenderName',
      'VCB',
      '0',
      '999',
      '{"status":["ACTIVE"]}',
      'only',
    );
    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'lenderName',
      'VCB',
      1,
      200,
      '{"status":["ACTIVE"]}',
      'only',
      undefined,
    );
  });

  it('should call hardDelete on permanent delete route', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const res = await controller.hardDelete(id);
    expect(service.hardDelete).toHaveBeenCalledWith(id, undefined);
    expect(res).toEqual({ id: 'l1' });
  });

  it('should enforce RBAC permissions for columnOptions and hardDelete', () => {
    const colPerms = Reflect.getMetadata(
      RBAC_PERMISSIONS_KEY,
      LoansController.prototype.columnOptions,
    );
    const purgePerms = Reflect.getMetadata(
      RBAC_PERMISSIONS_KEY,
      LoansController.prototype.hardDelete,
    );
    expect(colPerms).toEqual([
      { resource: ErpResource.LOANS, action: ErpAction.READ },
    ]);
    expect(purgePerms).toEqual([
      { resource: ErpResource.LOANS, action: ErpAction.PURGE },
    ]);
  });

  it('should call findOne with uuid', async () => {
    const res = await controller.findOne(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(service.findOne).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      undefined,
    );
    expect(res.title).toBe('Car Loan');
  });

  it('should call getCashflowProjection', async () => {
    await controller.getCashflowProjection();
    expect(service.getCashflowProjection).toHaveBeenCalled();
  });
});
