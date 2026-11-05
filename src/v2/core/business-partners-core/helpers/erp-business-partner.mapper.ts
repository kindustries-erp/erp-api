import { ErpBusinessPartner } from '../entities/erp_business_partner.entity';
import { CreateErpBusinessPartnerDto } from '../dto/create-erp-business-partner.dto';
import { ErpBusinessPartnerResponseDto } from '../dto/erp-business-partner-response.dto';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. */
export function toErpBusinessPartnerResponse(
  entity: ErpBusinessPartner,
): ErpBusinessPartnerResponseDto {
  return {
    id: entity.id,
    code: entity.code ?? undefined,
    name: entity.name,
    displayName: entity.displayName ?? undefined,
    partnerType: entity.partnerType,
    taxCode: entity.taxCode ?? undefined,
    phone: entity.phone ?? undefined,
    email: entity.email ?? undefined,
    address: entity.address ?? undefined,
    contactName: entity.contactName ?? undefined,
    status: entity.status,
    notes: entity.notes ?? undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Chuyển dữ liệu DTO sang dạng ghi vào entity.
 * Bỏ các key `undefined` để cập nhật một phần không ghi đè giá trị cũ.
 */
export function toErpBusinessPartnerEntityFields(
  dto: Partial<CreateErpBusinessPartnerDto>,
): Partial<ErpBusinessPartner> {
  return omitUndefined<Partial<ErpBusinessPartner>>({
    code: dto.code,
    name: dto.name,
    displayName: dto.displayName,
    partnerType: dto.partnerType,
    taxCode: dto.taxCode,
    phone: dto.phone,
    email: dto.email,
    address: dto.address,
    contactName: dto.contactName,
    status: dto.status,
    notes: dto.notes,
  });
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
