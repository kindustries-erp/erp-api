import { EmployeeManagement } from '../entities/employee-management.entity';
import { CreateEmployeeManagementDto } from '../dto/create-employee-management.dto';
import {
  EmployeeLinkedUserDto,
  EmployeeManagementResponseDto,
} from '../dto/employee-management-response.dto';
import { maskNationalId } from './national-id.helper';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. CCCD luôn được che. */
export function toEmployeeManagementResponse(
  entity: EmployeeManagement,
  linkedUser: EmployeeLinkedUserDto | null = null,
): EmployeeManagementResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    employeeCode: entity.employeeCode,
    fullName: entity.fullName,
    email: entity.email ?? undefined,
    phone: entity.phone ?? undefined,
    status: entity.status,
    address: entity.address ?? undefined,
    notes: entity.notes ?? undefined,
    birthDate: entity.birthDate ?? undefined,
    startDate: entity.startDate ?? undefined,
    leaveDate: entity.leaveDate ?? undefined,
    jobTitle: entity.jobTitle ?? undefined,
    department: entity.department ?? undefined,
    branchId: entity.branchId ?? undefined,
    branch: entity.branch
      ? {
          id: entity.branch.id,
          code: entity.branch.code,
          name: entity.branch.name,
        }
      : null,
    nationalIdMasked: maskNationalId(entity.nationalId),
    linkedUser,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/** `undefined` giữ nguyên (không ghi), `null` xóa giá trị, chuỗi ISO đổi thành Date. */
const toDate = (value: string | null | undefined): Date | null | undefined =>
  value == null ? value : new Date(value);

/** Cột bắt buộc không nhận null: bỏ qua thay vì ghi null xuống DB. */
const required = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

/**
 * Chuyển DTO sang dạng ghi vào entity (ISO string thành Date).
 * Bỏ key `undefined` để cập nhật một phần không ghi đè giá trị cũ; `null` xóa giá trị (cột nullable).
 * Không ghi `userId`/`extraData`.
 */
export function toEmployeeManagementEntityFields(
  dto: Partial<CreateEmployeeManagementDto>,
): Partial<EmployeeManagement> {
  const fields: Partial<EmployeeManagement> = {
    employeeCode: required(dto.employeeCode),
    fullName: required(dto.fullName),
    email: dto.email,
    phone: dto.phone,
    status: required(dto.status),
    address: dto.address,
    notes: dto.notes,
    birthDate: toDate(dto.birthDate),
    startDate: toDate(dto.startDate),
    leaveDate: toDate(dto.leaveDate),
    jobTitle: dto.jobTitle,
    department: dto.department,
    branchId: dto.branchId,
    nationalId: dto.nationalId,
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  ) as Partial<EmployeeManagement>;
}
