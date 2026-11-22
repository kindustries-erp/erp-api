import { BadRequestException, PipeTransform, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate, ValidationError } from 'class-validator';

/**
 * Validate body theo kiểu nhưng bỏ qua field thừa (không trả 400 như forbidNonWhitelisted).
 *
 * Gắn ở tham số: @Body(new ParseBranchBodyPipe(CreateErpBranchDto)).
 * Tham số có metatype Object nên ValidationPipe toàn cục bỏ qua, pipe này chạy sau đó.
 */
export class ParseBranchBodyPipe implements PipeTransform {
  private readonly declaredKeys: Set<string>;

  constructor(private readonly dtoClass: Type<object>) {
    this.declaredKeys = new Set(
      getMetadataStorage()
        // targetSchema '' = không dùng schema-based validation (chỉ lấy metadata của class).
        .getTargetValidationMetadatas(dtoClass, '', true, false)
        .map((meta) => meta.propertyName),
    );
  }

  async transform(value: unknown): Promise<Record<string, unknown>> {
    const plain: Record<string, unknown> =
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const dto = plainToInstance(this.dtoClass, plain);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(collectMessages(errors));
    }

    return Object.fromEntries(
      Object.entries(plain).filter(
        ([key, val]) => this.declaredKeys.has(key) && val !== undefined,
      ),
    );
  }
}

function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}
