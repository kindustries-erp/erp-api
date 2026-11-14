import { normalizeVietnamese } from '@/v2/core/base-core';
import { GarageItem } from '../entities/garage-item.entity';
import { CreateGarageItemDto } from '../dto/create-garage-item.dto';
import { GarageItemResponseDto } from '../dto/garage-item-response.dto';
import { normalizeItemCode } from './garage-item-code.helper';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. */
export function toGarageItemResponse(
  entity: GarageItem,
): GarageItemResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    itemCode: entity.itemCode,
    itemName: entity.itemName,
    unit: entity.unit ?? undefined,
    itemType: entity.itemType ?? undefined,
    source: entity.source,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Chuyển dữ liệu DTO sang dạng ghi vào entity: chuẩn hóa mã, tự tính tên không dấu.
 * Bỏ các key `undefined` để cập nhật một phần không ghi đè giá trị cũ.
 */
export function toGarageItemEntityFields(
  dto: Partial<CreateGarageItemDto>,
): Partial<GarageItem> {
  const itemName = dto.itemName?.replace(/\s+/g, ' ').trim();
  return omitUndefined<Partial<GarageItem>>({
    itemCode:
      dto.itemCode === undefined ? undefined : normalizeItemCode(dto.itemCode),
    itemName,
    nameNormalized:
      itemName === undefined ? undefined : normalizeVietnamese(itemName),
    unit: dto.unit?.trim(),
    itemType: dto.itemType,
    isActive: dto.isActive,
  });
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
