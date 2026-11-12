import { Test, TestingModule } from '@nestjs/testing';
import { LoansController } from './loans.controller';
import { LoansService } from '../loans.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

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
      }),
      findOne: jest.fn().mockResolvedValue({ id: 'l1', title: 'Car Loan' }),
      create: jest.fn().mockResolvedValue({ id: 'l1', title: 'Car Loan' }),
      update: jest.fn().mockResolvedValue({ id: 'l1', title: 'Updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
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

  it('should call findAll', async () => {
    const q = { page: 1, pageSize: 20 };
    const res = await controller.findAll(q);
    expect(service.findAll).toHaveBeenCalledWith(q);
    expect(res.pagination.total).toBe(0);
  });

  it('should call findOne with uuid', async () => {
    const res = await controller.findOne(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(service.findOne).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(res.title).toBe('Car Loan');
  });

  it('should call getCashflowProjection', async () => {
    await controller.getCashflowProjection();
    expect(service.getCashflowProjection).toHaveBeenCalled();
  });
});
