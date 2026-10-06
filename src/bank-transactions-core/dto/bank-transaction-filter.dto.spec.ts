import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BankTransactionFilterDto } from './bank-transaction-filter.dto';

describe('BankTransactionFilterDto Validation & Transforms', () => {
  it('transforms object columnFilters into JSON string', async () => {
    const plain = {
      page: '1',
      pageSize: '50',
      sourceType: 'BANK',
      columnFilters: { correspondentName: ['00003543046'] },
      columnSearch: { correspondentName: '' },
    };

    const dto = plainToInstance(BankTransactionFilterDto, plain);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.columnFilters).toBe('{"correspondentName":["00003543046"]}');
    expect(dto.columnSearch).toBe('{"correspondentName":""}');
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(50);
  });

  it('accepts snake_case column_filters and column_search strings', async () => {
    const plain = {
      column_filters: '{"correspondentName":["00003543046"]}',
      column_search: '{"correspondentName":"abc"}',
    };

    const dto = plainToInstance(BankTransactionFilterDto, plain);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.column_filters).toBe('{"correspondentName":["00003543046"]}');
    expect(dto.column_search).toBe('{"correspondentName":"abc"}');
  });

  it('transforms sorts string and array formats', async () => {
    const plainWithArray = {
      sorts: ['transDate', '-debitAmount'],
    };
    const dto1 = plainToInstance(BankTransactionFilterDto, plainWithArray);
    const errors1 = await validate(dto1);
    expect(errors1.length).toBe(0);
    expect(dto1.sorts).toEqual(['transDate', '-debitAmount']);

    const plainWithString = {
      sorts: '["-transDate"]',
    };
    const dto2 = plainToInstance(BankTransactionFilterDto, plainWithString);
    const errors2 = await validate(dto2);
    expect(errors2.length).toBe(0);
    expect(dto2.sorts).toEqual(['-transDate']);
  });

  it('passes strict NestJS ValidationPipe with object columnFilters without throwing 400', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const plain = {
      page: '1',
      pageSize: '50',
      sourceType: 'BANK',
      columnFilters: { correspondentName: ['00003543046'] },
      columnSearch: { correspondentName: '' },
    };

    const transformed = await pipe.transform(plain, {
      type: 'query',
      metatype: BankTransactionFilterDto,
    });

    expect(transformed).toBeInstanceOf(BankTransactionFilterDto);
    expect(transformed.columnFilters).toBe(
      '{"correspondentName":["00003543046"]}',
    );
    expect(transformed.page).toBe(1);
    expect(transformed.pageSize).toBe(50);
  });
});
