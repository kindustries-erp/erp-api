import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { applyGlobalPrefix } from '@/common/config/global-prefix.config';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { EmployeesManagementService } from '../employees-management.service';
import { EmployeeManagementController } from './employee-management.controller';

const ID = '3f2c1f0e-8d3a-4b1e-9a55-0c7f2d9b6a11';

describe('EmployeeManagementController', () => {
  let app: INestApplication;
  const service = {
    findAll: jest.fn(),
    findColumnOptions: jest.fn(),
    getNextCode: jest.fn(),
    findOne: jest.fn(),
    getNationalId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmployeeManagementController],
      providers: [{ provide: EmployeesManagementService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalPrefix(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const fn of Object.values(service)) fn.mockResolvedValue({ ok: true });
  });

  it('chỉ có route /api/v2/employees, không có alias v1', async () => {
    await request(app.getHttpServer()).get('/api/v2/employees').expect(200);
    await request(app.getHttpServer()).get('/api/v1/employees').expect(404);
  });

  it('column-options và next-code không bị hiểu thành :id', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/employees/next-code')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v2/employees/column-options?column=department')
      .expect(200);
    expect(service.getNextCode).toHaveBeenCalledTimes(1);
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'department',
      undefined,
      1,
      20,
      undefined,
    );
  });

  it('id không phải UUID trả 400, không gọi service', async () => {
    await request(app.getHttpServer()).get('/api/v2/employees/abc').expect(400);
    await request(app.getHttpServer())
      .patch('/api/v2/employees/abc')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .delete('/api/v2/employees/abc')
      .expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('POST kiểm tra DTO: thiếu tên, email sai, CCCD sai độ dài, userId bị từ chối', async () => {
    const post = (body: object) =>
      request(app.getHttpServer()).post('/api/v2/employees').send(body);
    await post({}).expect(400);
    await post({ fullName: 'A', email: 'khong-phai-email' }).expect(400);
    await post({ fullName: 'A', nationalId: '12345678' }).expect(400);
    await post({ fullName: 'A', userId: ID }).expect(400);
    await post({ fullName: 'A', branchId: 'x' }).expect(400);
    await post({ fullName: 'A', birthDate: 'hôm qua' }).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('POST hợp lệ chuyển DTO (CCCD 12 số, ngày ISO) xuống facade', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/employees')
      .send({
        fullName: 'Nguyễn Văn A',
        nationalId: '001234567890',
        birthDate: '1990-04-30T17:00:00.000Z',
        branchId: ID,
        jobTitle: 'Thợ',
        department: 'Xưởng',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ nationalId: '001234567890', branchId: ID }),
    );
  });

  it('POST /:id/status chỉ nhận ACTIVE hoặc INACTIVE', async () => {
    await request(app.getHttpServer())
      .post(`/api/v2/employees/${ID}/status`)
      .send({ status: 'DELETED' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v2/employees/${ID}/status`)
      .send({ status: 'INACTIVE' })
      .expect(201);
    expect(service.updateStatus).toHaveBeenCalledWith(ID, {
      status: 'INACTIVE',
    });
  });

  it('mỗi route gắn đúng quyền employees (CCCD đầy đủ cần UPDATE)', () => {
    const proto = EmployeeManagementController.prototype;
    const need = (name: keyof EmployeeManagementController) =>
      Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]) as Array<{
        resource: string;
        action: string;
      }>;
    const expected: Array<[keyof EmployeeManagementController, ErpAction]> = [
      ['findAll', ErpAction.READ],
      ['columnOptions', ErpAction.READ],
      ['getNextCode', ErpAction.READ],
      ['findOne', ErpAction.READ],
      ['getNationalId', ErpAction.UPDATE],
      ['create', ErpAction.CREATE],
      ['update', ErpAction.UPDATE],
      ['updateStatus', ErpAction.UPDATE],
      ['remove', ErpAction.DELETE],
    ];
    for (const [name, action] of expected) {
      expect(need(name)).toEqual([{ resource: ErpResource.EMPLOYEES, action }]);
    }
  });
});
