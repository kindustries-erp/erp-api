import { Reflector } from '@nestjs/core';
import { ErpAttachmentsCoreController } from './erp-attachments-core.controller';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { RBAC_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';

describe('ErpAttachmentsCoreController', () => {
  const service = {
    findAll: jest.fn(),
    getColumnOptions: jest.fn(),
    uploadFile: jest.fn(),
    remove: jest.fn(),
    getDownloadUrl: jest.fn(),
    findOne: jest.fn(),
    getFileContent: jest.fn(),
  } as any;

  let controller: ErpAttachmentsCoreController;
  const reflector = new Reflector();

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ErpAttachmentsCoreController(service);
  });

  describe('RBAC Metadata Verification', () => {
    it('requires ATTACHMENTS:READ permission on findAll', () => {
      const perms = reflector.get(RBAC_PERMISSIONS_KEY, controller.findAll);
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.READ },
      ]);
    });

    it('requires ATTACHMENTS:READ permission on getColumnOptions', () => {
      const perms = reflector.get(
        RBAC_PERMISSIONS_KEY,
        controller.getColumnOptions,
      );
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.READ },
      ]);
    });

    it('requires ATTACHMENTS:CREATE permission on uploadFile', () => {
      const perms = reflector.get(RBAC_PERMISSIONS_KEY, controller.uploadFile);
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.CREATE },
      ]);
    });

    it('requires ATTACHMENTS:DELETE permission on remove', () => {
      const perms = reflector.get(RBAC_PERMISSIONS_KEY, controller.remove);
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.DELETE },
      ]);
    });

    it('requires ATTACHMENTS:READ permission on getDownloadUrl', () => {
      const perms = reflector.get(
        RBAC_PERMISSIONS_KEY,
        controller.getDownloadUrl,
      );
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.READ },
      ]);
    });

    it('requires ATTACHMENTS:READ permission on getFileContent', () => {
      const perms = reflector.get(
        RBAC_PERMISSIONS_KEY,
        controller.getFileContent,
      );
      expect(perms).toEqual([
        { resource: ErpResource.ATTACHMENTS, action: ErpAction.READ },
      ]);
    });
  });

  describe('Service Delegation', () => {
    it('delegates findAll to service', async () => {
      const query = { page: '1', pageSize: '20' };
      service.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findAll(query);
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('delegates remove to service', async () => {
      service.remove.mockResolvedValue({ success: true });

      const result = await controller.remove('att-1');
      expect(result).toEqual({ success: true });
      expect(service.remove).toHaveBeenCalledWith('att-1');
    });

    it('delegates getDownloadUrl to service', async () => {
      service.getDownloadUrl.mockResolvedValue({
        url: 'https://r2.example.com',
      });

      const result = await controller.getDownloadUrl('att-1', 'true');
      expect(result).toEqual({ url: 'https://r2.example.com' });
      expect(service.getDownloadUrl).toHaveBeenCalledWith('att-1', true);
    });
  });
});
