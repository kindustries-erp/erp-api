import { BadRequestException } from '@nestjs/common';
import { CreateErpBranchDto } from '../dto/create-erp-branch.dto';
import { UpdateErpBranchDto } from '../dto/update-erp-branch.dto';
import { ParseBranchBodyPipe } from './parse-branch-body.pipe';

describe('ParseBranchBodyPipe', () => {
  const createPipe = new ParseBranchBodyPipe(CreateErpBranchDto);
  const updatePipe = new ParseBranchBodyPipe(UpdateErpBranchDto);

  describe('POST (CreateErpBranchDto)', () => {
    it('passes the UI payload {code,name,is_active} unchanged', async () => {
      await expect(
        createPipe.transform({ code: 'HN', name: 'Ha Noi', is_active: false }),
      ).resolves.toEqual({ code: 'HN', name: 'Ha Noi', is_active: false });
    });

    it('drops unknown fields instead of rejecting them', async () => {
      await expect(
        createPipe.transform({
          code: 'HN',
          name: 'Ha Noi',
          address: 'x',
          foo: 1,
        }),
      ).resolves.toEqual({ code: 'HN', name: 'Ha Noi' });
    });

    it.each([
      ['missing code', { name: 'Ha Noi' }],
      ['missing name', { code: 'HN' }],
      ['non-string code', { code: 123, name: 'Ha Noi' }],
      ['empty code', { code: '', name: 'Ha Noi' }],
      ['code longer than 100', { code: 'x'.repeat(101), name: 'Ha Noi' }],
      ['name longer than 255', { code: 'HN', name: 'x'.repeat(256) }],
      [
        'non-boolean is_active',
        { code: 'HN', name: 'Ha Noi', is_active: 'abc' },
      ],
      [
        'string "true" is_active',
        { code: 'HN', name: 'Ha Noi', is_active: 'true' },
      ],
      ['null is_active', { code: 'HN', name: 'Ha Noi', is_active: null }],
      ['non-object body', 'not-an-object'],
      ['missing body', undefined],
    ])('rejects %s with 400', async (_label, body) => {
      await expect(createPipe.transform(body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('PATCH (UpdateErpBranchDto)', () => {
    it('accepts an empty body and partial fields', async () => {
      await expect(updatePipe.transform({})).resolves.toEqual({});
      await expect(updatePipe.transform({ name: 'Moi' })).resolves.toEqual({
        name: 'Moi',
      });
      await expect(
        updatePipe.transform({ is_active: false, extra: 1 }),
      ).resolves.toEqual({ is_active: false });
    });

    it.each([
      ['null name', { name: null }],
      ['empty code', { code: '' }],
      ['non-boolean is_active', { is_active: 'abc' }],
    ])('rejects %s with 400', async (_label, body) => {
      await expect(updatePipe.transform(body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
