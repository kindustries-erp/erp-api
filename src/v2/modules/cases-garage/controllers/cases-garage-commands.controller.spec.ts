import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { CasesGarageCommandsController } from './cases-garage-commands.controller';

const proto = CasesGarageCommandsController.prototype as unknown as Record<
  string,
  () => void
>;
const route = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]),
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
});
const perms = (name: string) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]);

describe('CasesGarageCommandsController', () => {
  it('route tĩnh next-code có mặt và là GET', () => {
    expect(route('nextCode')).toEqual({
      path: 'next-code',
      method: RequestMethod.GET,
    });
  });

  it('RBAC dùng enum GARAGE với CREATE/UPDATE/DELETE đúng lệnh', () => {
    const toJson = (n: string) => JSON.stringify(perms(n));
    expect(toJson('create')).toContain(ErpAction.CREATE);
    expect(toJson('remove')).toContain(ErpAction.DELETE);
    expect(toJson('update')).toContain(ErpAction.UPDATE);
    expect(toJson('create')).toContain(ErpResource.GARAGE);
  });

  it('không gửi chi nhánh → facade nhận undefined (mọi chi nhánh); có thì chuyển xuống', () => {
    const service = { create: jest.fn(), remove: jest.fn() };
    const c = new CasesGarageCommandsController(service as never);
    c.create({} as never, undefined, { user: { sub: 'u' } });
    expect(service.create).toHaveBeenCalledWith(undefined, {}, 'u');
    c.remove('id', 'B1');
    expect(service.remove).toHaveBeenCalledWith('B1', 'id');
  });
});
