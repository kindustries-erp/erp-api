import { Test, TestingModule } from '@nestjs/testing';
import { LoansPublicController } from './loans-public.controller';
import { LoansService } from '../loans.service';
import { AmortizationMethod } from '@/v2/core/loans-core';

describe('LoansPublicController', () => {
  let controller: LoansPublicController;
  let service: any;

  beforeEach(async () => {
    service = {
      simulate: jest.fn().mockReturnValue({
        principalAmount: 10000000,
        schedule: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansPublicController],
      providers: [{ provide: LoansService, useValue: service }],
    }).compile();

    controller = module.get<LoansPublicController>(LoansPublicController);
  });

  it('should call simulate and return calculation result', () => {
    const dto = {
      principalAmount: 10000000,
      annualInterestRate: 10,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
    };

    const res = controller.simulate(dto);
    expect(service.simulate).toHaveBeenCalledWith(dto);
    expect(res.principalAmount).toBe(10000000);
  });
});
