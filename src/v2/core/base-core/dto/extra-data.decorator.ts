import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { explainExtraDataError } from '../helpers/extra-data.util';

/**
 * Field `extraData` trong DTO create/update: tùy chọn, không bắt buộc.
 * Client cũ không gửi field này vẫn hợp lệ.
 */
export function ExtraDataField(validationOptions?: ValidationOptions) {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'object',
      additionalProperties: true,
      description:
        'Dữ liệu tùy biến (jsonb). Update: merge cấp 1, giá trị null xóa key.',
    }),
    (target: object, propertyName: string) => {
      registerDecorator({
        name: 'isValidExtraData',
        target: target.constructor,
        propertyName,
        options: validationOptions,
        validator: {
          validate: (value: unknown) =>
            value === undefined || explainExtraDataError(value) === null,
          defaultMessage: (args: ValidationArguments) =>
            explainExtraDataError(args.value) ?? 'extraData không hợp lệ',
        },
      });
    },
  );
}
