import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PurgeFileAttachmentsBodyDto } from '../dto/purge-file-attachments.dto';
import { UpdateFileAttachmentSettingsDto } from '../dto/update-file-attachment-settings.dto';
import { FileAttachmentsService } from '../file-attachments-management.service';
import { FileAttachmentsController } from './file-attachments.controller';

const permissionsOf = (method: keyof FileAttachmentsController) =>
  Reflect.getMetadata(
    RBAC_PERMISSIONS_KEY,
    FileAttachmentsController.prototype[method],
  ) as Array<{ resource: string; action: string }>;

describe('FileAttachmentsController', () => {
  const files = {
    list: jest.fn(),
    columnOptions: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    purge: jest.fn(),
    purgeOne: jest.fn(),
    detail: jest.fn(),
    downloadUrl: jest.fn(),
    softDelete: jest.fn(),
  };
  const controller = new FileAttachmentsController(
    files as unknown as FileAttachmentsService,
  );
  const req = { user: { sub: 'u1' } };

  beforeEach(() => jest.resetAllMocks());

  it('có JwtAuthGuard và CoreRbacGuard (401/403)', () => {
    expect(
      Reflect.getMetadata('__guards__', FileAttachmentsController),
    ).toEqual(expect.arrayContaining([JwtAuthGuard, CoreRbacGuard]));
  });

  it('phân quyền đúng từng route (PURGE riêng cho xóa vĩnh viễn)', () => {
    const expected: Array<[keyof FileAttachmentsController, string]> = [
      ['list', 'read'],
      ['columnOptions', 'read'],
      ['getSettings', 'read'],
      ['updateSettings', 'update'],
      ['purge', 'purge'],
      ['detail', 'read'],
      ['downloadUrl', 'read'],
      ['remove', 'delete'],
      ['purgeOne', 'purge'],
    ];
    for (const [method, action] of expected) {
      expect(permissionsOf(method)).toEqual([
        { resource: 'attachments', action },
      ]);
    }
  });

  it('ủy quyền cho facade kèm người thực hiện', async () => {
    await controller.purge({ ids: ['a'] }, req);
    expect(files.purge).toHaveBeenCalledWith(['a'], 'u1');
    await controller.purgeOne('a', req);
    expect(files.purgeOne).toHaveBeenCalledWith('a', 'u1');
    await controller.remove('a', req);
    expect(files.softDelete).toHaveBeenCalledWith('a', 'u1');
    await controller.updateSettings({ autoPurgeEnabled: true }, req);
    expect(files.updateSettings).toHaveBeenCalledWith(
      { autoPurgeEnabled: true },
      'u1',
    );
  });

  it('downloadUrl chỉ inline khi inline=true; columnOptions chuẩn hóa phân trang', async () => {
    await controller.downloadUrl('a', 'true');
    expect(files.downloadUrl).toHaveBeenCalledWith('a', true);
    await controller.downloadUrl('a');
    expect(files.downloadUrl).toHaveBeenLastCalledWith('a', false);
    await controller.columnOptions('category', 'x', '0', '9999', 'only');
    expect(files.columnOptions).toHaveBeenCalledWith(
      'category',
      'x',
      1,
      200,
      expect.objectContaining({ deleted: 'only' }),
    );
  });

  it('columnOptions nhận filters dạng record hoặc envelope', async () => {
    await controller.columnOptions(
      'category',
      undefined,
      '1',
      '20',
      undefined,
      '{"origin":["LEGACY"]}',
    );
    expect(files.columnOptions).toHaveBeenLastCalledWith(
      'category',
      undefined,
      1,
      20,
      expect.objectContaining({ column_filters: { origin: ['LEGACY'] } }),
    );
    await controller.columnOptions(
      'category',
      undefined,
      '1',
      '20',
      undefined,
      '{"dateRanges":{"createdAt":{"from":"2026-11-01"}}}',
    );
    expect(files.columnOptions).toHaveBeenLastCalledWith(
      'category',
      undefined,
      1,
      20,
      expect.objectContaining({
        date_ranges: { createdAt: { from: '2026-11-01' } },
      }),
    );
  });

  it('DTO purge: bắt buộc 1..100 UUID', async () => {
    const check = (ids: unknown) =>
      validate(plainToInstance(PurgeFileAttachmentsBodyDto, { ids }));
    expect((await check([])).length).toBeGreaterThan(0);
    expect((await check(['not-uuid'])).length).toBeGreaterThan(0);
    expect(
      (await check(Array.from({ length: 101 }, () => crypto.randomUUID())))
        .length,
    ).toBeGreaterThan(0);
    expect(await check([crypto.randomUUID()])).toHaveLength(0);
  });

  it('DTO cài đặt: số ngày phải từ 1 đến 3650', async () => {
    const check = (retentionDays: unknown) =>
      validate(
        plainToInstance(UpdateFileAttachmentSettingsDto, { retentionDays }),
      );
    expect((await check(0)).length).toBeGreaterThan(0);
    expect((await check(3651)).length).toBeGreaterThan(0);
    expect((await check(1.5)).length).toBeGreaterThan(0);
    expect(await check(30)).toHaveLength(0);
  });
});
