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

  it('thiếu header chi nhánh → 400, có header thì chuyển xuống facade', () => {
    const service = { create: jest.fn(), remove: jest.fn() };
    const c = new CasesGarageCommandsController(service as never);
    expect(() =>
      c.create({} as never, undefined as never, { user: { sub: 'u' } }),
    ).toThrow(BadRequestException);
    c.remove('id', 'B1');
    expect(service.remove).toHaveBeenCalledWith('B1', 'id');
  });
});
