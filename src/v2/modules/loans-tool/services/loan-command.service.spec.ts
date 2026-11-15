import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LoanCommandService } from './loan-command.service';
import { LoanEntity, LoanPaymentEntity } from '../entities';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';
import { RbacCoreService } from '@/v2/core/rbac-core';

describe('LoanCommandService', () => {
  let service: LoanCommandService;
  let dataSource: any;
  let repo: any;
  let queryRunner: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((dto) => ({ id: 'new-id', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
      findOne: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((entity, dto) => ({ id: 'pay-id', ...dto })),
        save: jest.fn((entity) => Promise.resolve(entity)),
      },
    };

    dataSource = {
      getRepository: jest.fn().mockReturnValue(repo),
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      transaction: jest.fn(async (cb) => cb({ getRepository: () => repo })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanCommandService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: RbacCoreService,
          useValue: {
            hasAnyPermission: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<LoanCommandService>(LoanCommandService);
  });

  it('should create a new loan and initialize remaining principal', async () => {
    const dto = {
      title: 'Company Loan',
      lenderName: 'Vietcombank',
      principalAmount: 500000000,
      annualInterestRate: 9.5,
      tenorMonths: 36,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
    };

    const res = await service.create(dto, 'user-1');
    expect(res.title).toBe('Company Loan');
    expect(repo.save).toHaveBeenCalled();
  });

  it('should update loan fields including terms and recalculate remainingPrincipal', async () => {
    repo.findOne.mockResolvedValue({
      id: 'l1',
      title: 'Old Title',
      lenderName: 'Old Bank',
      isDeleted: false,
      principalAmount: '100000000',
      totalPaidPrincipal: '20000000',
      remainingPrincipal: '80000000',
      annualInterestRate: '10',
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-01-01',
    });

    const res = await service.update('l1', {
      title: 'New Title',
      lenderName: 'VCB',
      principalAmount: 200000000,
      annualInterestRate: 8.5,
      tenorMonths: 24,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-03-01',
    });
    expect(res.title).toBe('New Title');
    expect(res.lenderName).toBe('VCB');
    expect(res.principalAmount).toBe(200000000);
    expect(res.remainingPrincipal).toBe(180000000);
    expect(res.annualInterestRate).toBe(8.5);
    expect(res.tenorMonths).toBe(24);
    expect(res.amortizationMethod).toBe(AmortizationMethod.EQUAL_PRINCIPAL);
    expect(res.startDate).toBe('2026-03-01');
    expect(res.firstPaymentDate).toBe('2026-03-01');
  });

  it('should record payment with transaction lock and reduce remaining principal', async () => {
    const mockLoan = {
      id: 'l1',
      principalAmount: '100000000',
      totalPaidPrincipal: '0',
      totalPaidInterest: '0',
      remainingPrincipal: '100000000',
      annualInterestRate: '12',
      tenorMonths: 10,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
      status: LoanStatus.ACTIVE,
    };

    queryRunner.manager.findOne.mockResolvedValue(mockLoan);

    const res = await service.recordPayment(
      'l1',
      {
        periodNumber: 1,
        paymentDate: '2026-02-01',
        principalPaid: 10000000,
        interestPaid: 1000000,
        paymentRef: 'TX12345',
      },
      'user-1',
    );

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(res.totalPaidPrincipal).toBe(10000000);
    expect(res.remainingPrincipal).toBe(90000000);
  });

  it('should create multiple loans in a transaction via createBatch', async () => {
    const dtos = [
      {
        title: 'Loan 1',
        lenderName: 'VCB',
        principalAmount: 100000000,
        annualInterestRate: 10,
        tenorMonths: 12,
        amortizationMethod: AmortizationMethod.AMORTIZED,
        startDate: '2026-01-01',
      },
      {
        title: 'Loan 2',
        lenderName: 'TCB',
        principalAmount: 200000000,
        annualInterestRate: 9,
        tenorMonths: 24,
        amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
        startDate: '2026-02-01',
      },
    ];

    const results = await service.createBatch(dtos, 'user-1');
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Loan 1');
    expect(results[1].title).toBe('Loan 2');
  });

  it('should mark loan as COMPLETED when remaining principal reaches 0', async () => {
    const mockLoan = {
      id: 'l2',
      principalAmount: '100000000',
      totalPaidPrincipal: '90000000',
      totalPaidInterest: '5000000',
      remainingPrincipal: '10000000',
      annualInterestRate: '12',
      tenorMonths: 10,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
      status: LoanStatus.ACTIVE,
    };

    queryRunner.manager.findOne.mockResolvedValue(mockLoan);

    const res = await service.recordPayment(
      'l2',
      {
        periodNumber: 10,
        paymentDate: '2026-11-01',
        principalPaid: 10000000,
        interestPaid: 100000,
        paymentRef: 'TX-FINAL',
      },
      'user-1',
    );

    expect(res.totalPaidPrincipal).toBe(100000000);
    expect(res.remainingPrincipal).toBe(0);
    expect(res.status).toBe(LoanStatus.COMPLETED);
  });

  describe('updatePayment', () => {
    it('should update payment details and recalculate totals from all payments', async () => {
      const mockLoan = {
        id: 'l1',
        isDeleted: false,
        principalAmount: '100000000',
        annualInterestRate: '10',
        tenorMonths: 12,
        amortizationMethod: AmortizationMethod.AMORTIZED,
        startDate: '2026-01-01',
        firstPaymentDate: '2026-01-01',
        totalPaidPrincipal: '20000000',
        totalPaidInterest: '5000000',
        remainingPrincipal: '80000000',
        status: LoanStatus.ACTIVE,
      };

      const mockPayment = {
        id: 'p1',
        loanId: 'l1',
        periodNumber: 1,
        paymentDate: '2026-02-01',
        principalPaid: '20000000',
        interestPaid: '5000000',
        totalPaid: '25000000',
      };

      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockLoan)
        .mockResolvedValueOnce(mockPayment);

      queryRunner.manager.find = jest.fn().mockResolvedValueOnce([
        {
          id: 'p1',
          loanId: 'l1',
          principalPaid: '30000000',
          interestPaid: '4000000',
        },
      ]);

      const res = await service.updatePayment('l1', 'p1', {
        principalPaid: 30000000,
        interestPaid: 4000000,
      });

      expect(queryRunner.manager.save).toHaveBeenCalled();
      expect(res.totalPaidPrincipal).toBe(30000000);
      expect(res.totalPaidInterest).toBe(4000000);
      expect(res.remainingPrincipal).toBe(70000000);
    });
  });

  describe('chống trùng kỳ thanh toán', () => {
    const baseLoan = {
      id: 'l1',
      isDeleted: false,
      principalAmount: '100000000',
      totalPaidPrincipal: '0',
      totalPaidInterest: '0',
      remainingPrincipal: '100000000',
      annualInterestRate: '12',
      tenorMonths: 10,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
      status: LoanStatus.ACTIVE,
    };

    const payload = {
      periodNumber: 1,
      paymentDate: '2026-02-01',
      principalPaid: 10000000,
      interestPaid: 1000000,
    };

    it('recordPayment ném ConflictException khi kỳ đã có thanh toán', async () => {
      queryRunner.manager.findOne.mockResolvedValue({ ...baseLoan });
      queryRunner.manager.count.mockResolvedValueOnce(1);

      await expect(service.recordPayment('l1', payload)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('recordPayment cho phép ghi kỳ chưa có thanh toán', async () => {
      queryRunner.manager.findOne.mockResolvedValue({ ...baseLoan });
      queryRunner.manager.count.mockResolvedValueOnce(0);

      await expect(service.recordPayment('l1', payload)).resolves.toBeDefined();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('updatePayment ném ConflictException khi đổi sang kỳ của thanh toán khác', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baseLoan, totalPaidPrincipal: '10000000' })
        .mockResolvedValueOnce({
          id: 'p1',
          loanId: 'l1',
          periodNumber: 1,
          paymentDate: '2026-02-01',
          principalPaid: '10000000',
          interestPaid: '1000000',
          totalPaid: '11000000',
        });
      queryRunner.manager.count.mockResolvedValueOnce(1);

      await expect(
        service.updatePayment('l1', 'p1', { periodNumber: 2 }),
      ).rejects.toThrow(ConflictException);
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('updatePayment cho phép giữ nguyên kỳ của chính thanh toán đang sửa', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baseLoan, totalPaidPrincipal: '10000000' })
        .mockResolvedValueOnce({
          id: 'p1',
          loanId: 'l1',
          periodNumber: 1,
          paymentDate: '2026-02-01',
          principalPaid: '10000000',
          interestPaid: '1000000',
          totalPaid: '11000000',
        });
      queryRunner.manager.find = jest.fn().mockResolvedValueOnce([]);
      queryRunner.manager.count.mockResolvedValueOnce(0);

      await expect(
        service.updatePayment('l1', 'p1', {
          periodNumber: 1,
          interestPaid: 2000000,
        }),
      ).resolves.toBeDefined();
      expect(queryRunner.manager.count).toHaveBeenCalledWith(
        LoanPaymentEntity,
        expect.objectContaining({
          where: expect.objectContaining({ loanId: 'l1', periodNumber: 1 }),
        }),
      );
    });
  });

  describe('deletePayment', () => {
    it('should delete payment and recalculate totals, reopening status if needed', async () => {
      const mockLoan = {
        id: 'l1',
        isDeleted: false,
        principalAmount: '100000000',
        annualInterestRate: '10',
        tenorMonths: 12,
        amortizationMethod: AmortizationMethod.AMORTIZED,
        startDate: '2026-01-01',
        firstPaymentDate: '2026-01-01',
        totalPaidPrincipal: '100000000',
        totalPaidInterest: '5000000',
        remainingPrincipal: '0',
        status: LoanStatus.COMPLETED,
      };

      const mockPayment = {
        id: 'p1',
        loanId: 'l1',
      };

      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockLoan)
        .mockResolvedValueOnce(mockPayment);

      queryRunner.manager.remove = jest.fn().mockResolvedValueOnce(mockPayment);
      queryRunner.manager.find = jest.fn().mockResolvedValueOnce([]);

      const res = await service.deletePayment('l1', 'p1');

      expect(queryRunner.manager.remove).toHaveBeenCalledWith(mockPayment);
      expect(res.totalPaidPrincipal).toBe(0);
      expect(res.remainingPrincipal).toBe(100000000);
      expect(res.status).toBe(LoanStatus.ACTIVE);
    });
  });

  describe('hardDelete', () => {
    it('xóa cứng thành công khi khoản vay đã xóa mềm và không có lịch sử thanh toán', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValue({ id: 'l1', isDeleted: true }),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      dataSource.transaction.mockImplementationOnce(async (cb: any) =>
        cb(manager),
      );

      await service.hardDelete('l1');

      expect(manager.findOne).toHaveBeenCalledWith(LoanEntity, {
        where: { id: 'l1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.count).toHaveBeenCalledWith(LoanPaymentEntity, {
        where: { loanId: 'l1' },
      });
      expect(manager.delete).toHaveBeenCalledWith(LoanEntity, 'l1');
    });

    it('ném NotFoundException nếu khoản vay không tồn tại', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementationOnce(async (cb: any) =>
        cb(manager),
      );

      await expect(service.hardDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném ConflictException nếu khoản vay chưa xóa mềm', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValue({ id: 'l1', isDeleted: false }),
        delete: jest.fn(),
      };
      dataSource.transaction.mockImplementationOnce(async (cb: any) =>
        cb(manager),
      );

      await expect(service.hardDelete('l1')).rejects.toThrow(ConflictException);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('ném ConflictException nếu khoản vay đã có lịch sử thanh toán', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValue({ id: 'l1', isDeleted: true }),
        count: jest.fn().mockResolvedValue(2),
        delete: jest.fn(),
      };
      dataSource.transaction.mockImplementationOnce(async (cb: any) =>
        cb(manager),
      );

      await expect(service.hardDelete('l1')).rejects.toThrow(ConflictException);
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });
});
