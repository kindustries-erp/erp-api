import { Test, TestingModule } from '@nestjs/testing';
import { KgaraSuppliersController } from './kgara-suppliers.controller';
import { KgaraSuppliersService } from '../services/kgara-suppliers.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';

describe('KgaraSuppliersController (Facade Delegate)', () => {
  let controller: KgaraSuppliersController;
  let service: any;

  beforeEach(async () => {
    service = {
      getSuppliersDebt: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        summary: {},
      }),
      getSuppliersDebtColumnOptions: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
      getCasesBySupplier: jest.fn().mockResolvedValue({
        payables: [],
        linkedCases: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KgaraSuppliersController],
      providers: [
        {
          provide: KgaraSuppliersService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KgaraSuppliersController>(KgaraSuppliersController);
  });

  it('should delegate getSuppliersDebt to KgaraSuppliersService', async () => {
    await controller.getSuppliersDebt(
      'BR-01',
      '1',
      '20',
      'test',
      '2026-07-01',
      '2026-07-31',
      ['-balance'],
      undefined,
      '{"accountCode":["331"]}',
      '{"supplierCode":"NCC01"}',
    );

    expect(service.getSuppliersDebt).toHaveBeenCalledWith({
      branchId: 'BR-01',
      page: '1',
      pageSize: '20',
      q: 'test',
      from: '2026-07-01',
      to: '2026-07-31',
      sorts: ['-balance'],
      filtersStr: undefined,
      column_filters: '{"accountCode":["331"]}',
      column_search: '{"supplierCode":"NCC01"}',
    });
  });

  it('should delegate getSuppliersDebtColumnOptions to service', async () => {
    await controller.getSuppliersDebtColumnOptions(
      'BR-01',
      'supplierName',
      'A',
      '1',
      '20',
    );

    expect(service.getSuppliersDebtColumnOptions).toHaveBeenCalledWith(
      'BR-01',
      'supplierName',
      'A',
      '1',
      '20',
      undefined,
    );
  });

  it('should delegate getCasesBySupplier to service', async () => {
    await controller.getCasesBySupplier('BR-01', 'SUPP-01');

    expect(service.getCasesBySupplier).toHaveBeenCalledWith('BR-01', 'SUPP-01');
  });
});
