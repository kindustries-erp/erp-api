import { Test, TestingModule } from '@nestjs/testing';

import { RBAC_PERMISSIONS_KEY } from '../../auth/decorators/require-permissions.decorator';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { GarageDebtsExportService } from '../services/garage-debts-export.service';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import { KgaraCompletedCasesExportService } from '../services/kgara-completed-cases-export.service';
import { GarageCasesExportController } from './garage-cases-export.controller';
import { GarageDebtsExportController } from './garage-debts-export.controller';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const req = (sub: string) => ({ user: { sub } });

const routeMethods = (proto: object) =>
  Object.getOwnPropertyNames(proto).filter(
    (name) =>
      name !== 'constructor' &&
      Reflect.getMetadata('path', (proto as any)[name]) !== undefined,
  );

describe('Garage export controllers', () => {
  let casesController: GarageCasesExportController;
  let debtsController: GarageDebtsExportController;
  let jobs: GarageExportJobsService;
  const casesExport = {
    exportCompletedCasesExcel: jest
      .fn()
      .mockResolvedValue(Buffer.from('cases')),
  };
  const debtsExport = {
    PROGRESS: 100,
    normalizeFilters: jest.fn((dto) => dto),
    exportExcel: jest.fn().mockResolvedValue(Buffer.from('debts')),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GarageCasesExportController, GarageDebtsExportController],
      providers: [
        GarageExportJobsService,
        { provide: KgaraCompletedCasesExportService, useValue: casesExport },
        { provide: GarageDebtsExportService, useValue: debtsExport },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    casesController = module.get(GarageCasesExportController);
    debtsController = module.get(GarageDebtsExportController);
    jobs = module.get(GarageExportJobsService);
  });

  afterEach(() => jobs.onModuleDestroy());

  describe('RBAC metadata', () => {
    const expectPermission = (proto: object, resource: ErpResource) => {
      const methods = routeMethods(proto);
      expect(methods.length).toBeGreaterThan(0);
      for (const name of methods) {
        expect({
          name,
          perms: Reflect.getMetadata(
            RBAC_PERMISSIONS_KEY,
            (proto as any)[name],
          ),
        }).toEqual({
          name,
          perms: [{ resource, action: ErpAction.READ }],
        });
      }
    };

    it('cases export: mọi route (kể cả SSE) yêu cầu GARAGE:READ', () => {
      expectPermission(
        GarageCasesExportController.prototype,
        ErpResource.GARAGE,
      );
    });

    it('debts export: mọi route (kể cả SSE) yêu cầu GARAGE_DEBTS:READ', () => {
      expectPermission(
        GarageDebtsExportController.prototype,
        ErpResource.GARAGE_DEBTS,
      );
    });
  });

  describe('cases export', () => {
    it('khởi tạo job, truyền branch + filter, lưu lịch sử theo user', async () => {
      const result = casesController.start(
        { mode: 'by-current-filter', sorts: ['-doanhThu'], filtersStr: '{}' },
        'CN1',
        req('u1'),
      );
      expect(result).toMatchObject({ reused: false });
      await flush();

      expect(casesExport.exportCompletedCasesExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'by-current-filter',
          branchId: 'CN1',
          sorts: ['-doanhThu'],
        }),
      );

      const history = casesController.history(req('u1'));
      expect(history.items[0]).toMatchObject({
        status: 'COMPLETED',
        canDownload: true,
      });
      expect(history.items[0].fileName).toContain('theo_bo_loc');
      expect(casesController.history(req('u2')).total).toBe(0);
    });

    it('fingerprint gồm branchId: không dùng lại file của chi nhánh khác', async () => {
      const a = casesController.start({}, 'CN1', req('u1'));
      await flush();
      const same = casesController.start({}, 'CN1', req('u1'));
      const other = casesController.start({}, 'CN2', req('u1'));

      expect(same).toMatchObject({ jobId: a.jobId, reused: true });
      expect(other.jobId).not.toBe(a.jobId);
      await flush();
    });

    it('tải file: đúng user nhận buffer, user khác bị chặn', async () => {
      const { jobId } = casesController.start({}, 'CN1', req('u1'));
      await flush();

      const res: any = { setHeader: jest.fn(), send: jest.fn() };
      casesController.download(jobId, req('u1'), res);
      expect(res.send).toHaveBeenCalledWith(Buffer.from('cases'));
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename='),
      );

      expect(() => casesController.download(jobId, req('u2'), res)).toThrow();
    });

    it('SSE chỉ phát sự kiện của user hiện tại', async () => {
      const received: any[] = [];
      const sub = casesController
        .progressStream(req('u1'))
        .subscribe((e: any) => received.push(JSON.parse(e.data)));

      casesController.start({ q: 'a' }, 'CN1', req('u2'));
      casesController.start({ q: 'b' }, 'CN1', req('u1'));
      await flush();
      sub.unsubscribe();

      const real = received.filter((e) => e.processId !== 'ping');
      expect(real.length).toBeGreaterThan(0);
      expect(real.every((e) => e.userId === 'u1')).toBe(true);
      expect(received[0]).toMatchObject({
        processId: 'ping',
        message: 'Connected',
      });
    });
  });

  describe('debts export', () => {
    it('khách hàng và NCC có runner độc lập, gọi đúng kind', async () => {
      const customers = debtsController.startCustomers(
        { from: '2026-07-01' },
        'CN1',
        req('u1'),
      );
      const suppliers = debtsController.startSuppliers(
        { from: '2026-07-01' },
        'CN1',
        req('u1'),
      );

      expect(customers.jobId).not.toBe(suppliers.jobId);
      await flush();

      expect(debtsExport.exportExcel).toHaveBeenCalledWith(
        'customers',
        'CN1',
        expect.anything(),
        expect.any(Function),
      );
      expect(debtsExport.exportExcel).toHaveBeenCalledWith(
        'suppliers',
        'CN1',
        expect.anything(),
        expect.any(Function),
      );

      expect(
        debtsController.customersHistory(req('u1')).items[0].fileName,
      ).toContain('Cong_no_phai_thu_khach_hang');
      expect(
        debtsController.suppliersHistory(req('u1')).items[0].fileName,
      ).toContain('Cong_no_phai_tra_nha_cung_cap');
    });

    it('tải file công nợ theo đúng runner', async () => {
      const { jobId } = debtsController.startCustomers({}, 'CN1', req('u1'));
      await flush();

      const res: any = { setHeader: jest.fn(), send: jest.fn() };
      debtsController.downloadCustomers(jobId, req('u1'), res);
      expect(res.send).toHaveBeenCalledWith(Buffer.from('debts'));

      // jobId của runner khách hàng không tải được qua endpoint NCC
      expect(() =>
        debtsController.downloadSuppliers(jobId, req('u1'), res),
      ).toThrow();
    });
  });
});
