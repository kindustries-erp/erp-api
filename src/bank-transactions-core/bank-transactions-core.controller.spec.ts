import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';
import { BankTransactionsCoreController } from './bank-transactions-core.controller';
import { BankTransactionsCoreService } from './bank-transactions-core.service';

const UUID = '6f1c2a3e-8b7d-4e2f-9a1b-0c3d4e5f6a7b';

describe('BankTransactionsCoreController — balances (ParseUUIDPipe)', () => {
  let app: INestApplication;
  let service: Record<string, jest.Mock>;

  beforeAll(async () => {
    service = {
      getBankAccountBalances: jest.fn().mockResolvedValue([]),
      updateBankAccountBalance: jest.fn().mockResolvedValue({}),
      deleteBankAccountBalance: jest.fn().mockResolvedValue({}),
      getCashBookBalances: jest.fn().mockResolvedValue([]),
      updateCashBookBalance: jest.fn().mockResolvedValue({}),
      deleteCashBookBalance: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BankTransactionsCoreController],
      providers: [
        { provide: BankTransactionsCoreService, useValue: service },
        { provide: DocumentTraceabilityService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bank-account-balances', () => {
    it('GET với bankAccountId không phải UUID → 400, không gọi service', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/bank-account-balances')
        .query({ bankAccountId: 'x' })
        .expect(400);
      expect(service.getBankAccountBalances).not.toHaveBeenCalled();
    });

    it('GET thiếu bankAccountId → 400', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/bank-account-balances')
        .expect(400);
      expect(service.getBankAccountBalances).not.toHaveBeenCalled();
    });

    it('GET với UUID hợp lệ → 200 và service nhận đúng id', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/bank-account-balances')
        .query({ bankAccountId: UUID })
        .expect(200);
      expect(service.getBankAccountBalances).toHaveBeenCalledWith(UUID);
    });

    it('PATCH :id không phải UUID → 400', async () => {
      await request(app.getHttpServer())
        .patch('/bank-transactions-core/bank-account-balances/x')
        .send({})
        .expect(400);
      expect(service.updateBankAccountBalance).not.toHaveBeenCalled();
    });

    it('DELETE :id không phải UUID → 400', async () => {
      await request(app.getHttpServer())
        .delete('/bank-transactions-core/bank-account-balances/x')
        .expect(400);
      expect(service.deleteBankAccountBalance).not.toHaveBeenCalled();
    });

    it('DELETE :id là UUID hợp lệ → service nhận đúng id', async () => {
      await request(app.getHttpServer())
        .delete(`/bank-transactions-core/bank-account-balances/${UUID}`)
        .expect(200);
      expect(service.deleteBankAccountBalance).toHaveBeenCalledWith(UUID);
    });
  });

  describe('cash-book-balances', () => {
    it('GET với cashBookId không phải UUID → 400, không gọi service', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/cash-book-balances')
        .query({ cashBookId: 'x' })
        .expect(400);
      expect(service.getCashBookBalances).not.toHaveBeenCalled();
    });

    it('GET thiếu cashBookId → 400', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/cash-book-balances')
        .expect(400);
      expect(service.getCashBookBalances).not.toHaveBeenCalled();
    });

    it('GET với UUID hợp lệ → 200 và service nhận đúng id', async () => {
      await request(app.getHttpServer())
        .get('/bank-transactions-core/cash-book-balances')
        .query({ cashBookId: UUID })
        .expect(200);
      expect(service.getCashBookBalances).toHaveBeenCalledWith(UUID);
    });

    it('PATCH :id không phải UUID → 400', async () => {
      await request(app.getHttpServer())
        .patch('/bank-transactions-core/cash-book-balances/x')
        .send({})
        .expect(400);
      expect(service.updateCashBookBalance).not.toHaveBeenCalled();
    });

    it('DELETE :id không phải UUID → 400', async () => {
      await request(app.getHttpServer())
        .delete('/bank-transactions-core/cash-book-balances/x')
        .expect(400);
      expect(service.deleteCashBookBalance).not.toHaveBeenCalled();
    });

    it('PATCH :id là UUID hợp lệ → service nhận đúng id', async () => {
      await request(app.getHttpServer())
        .patch(`/bank-transactions-core/cash-book-balances/${UUID}`)
        .send({})
        .expect(200);
      expect(service.updateCashBookBalance).toHaveBeenCalledWith(
        UUID,
        expect.anything(),
      );
    });
  });
});
