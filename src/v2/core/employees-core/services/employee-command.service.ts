import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EmployeeManagement } from '../entities/employee-management.entity';
import { CreateEmployeeManagementDto } from '../dto/create-employee-management.dto';
import { UpdateEmployeeManagementDto } from '../dto/update-employee-management.dto';
import { toEmployeeManagementEntityFields } from '../helpers/employee-management.mapper';
import { assertEmployeeDates } from '../helpers/employee-dates.rules';
import {
  assertValidExtraData,
  mergeExtraData,
} from '../../base-core/helpers/extra-data.util';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';

/** Ghi dữ liệu: kiểm tra trùng, quy tắc ngày, tạo, cập nhật, đổi trạng thái, xóa mềm. Kiểm tra tồn tại theo id do Facade đảm nhiệm. */
@Injectable()
export class EmployeeCommandService {
  constructor(
    @InjectRepository(EmployeeManagement)
    private readonly repo: Repository<EmployeeManagement>,
  ) {}

  /** Mã so khớp không phân biệt hoa thường, bỏ qua bản ghi đã xóa mềm và `excludeId` (khi sửa). */
  async assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('LOWER(e.employeeCode) = LOWER(:code)', { code })
      .andWhere('e.isDeleted = :isDeleted', { isDeleted: false });
    if (excludeId) qb.andWhere('e.id != :excludeId', { excludeId });
    if (await qb.getOne()) {
      throw new ConflictException(`Mã nhân viên "${code}" đã tồn tại`);
    }
  }

  async assertNationalIdAvailable(
    nationalId: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.nationalId = :nationalId', { nationalId })
      .andWhere('e.isDeleted = :isDeleted', { isDeleted: false });
    if (excludeId) qb.andWhere('e.id != :excludeId', { excludeId });
    if (await qb.getOne()) {
      throw new ConflictException('CCCD đã thuộc về nhân viên khác');
    }
  }

  async create(dto: CreateEmployeeManagementDto): Promise<EmployeeManagement> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    const fields = toEmployeeManagementEntityFields(dto);
    assertEmployeeDates(fields);
    const entity = this.repo.create({
      ...fields,
      isDeleted: false,
      extraData: dto.extraData ?? {},
    });
    return this.save(entity);
  }

  async update(
    entity: EmployeeManagement,
    dto: UpdateEmployeeManagementDto,
  ): Promise<EmployeeManagement> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    const fields = toEmployeeManagementEntityFields(dto);
    // `null` là xóa ngày, nên so với giá trị sau khi áp dụng chứ không phải giá trị cũ
    const pick = <K extends 'birthDate' | 'startDate' | 'leaveDate'>(key: K) =>
      fields[key] !== undefined ? fields[key] : entity[key];
    assertEmployeeDates({
      birthDate: pick('birthDate'),
      startDate: pick('startDate'),
      leaveDate: pick('leaveDate'),
    });
    Object.assign(entity, fields);
    // `branch` đã nạp sẵn sẽ ghi đè `branchId` khi lưu; bỏ đi để cột branch_id là nguồn duy nhất
    if (fields.branchId !== undefined) entity.branch = undefined;
    if (dto.extraData !== undefined) {
      entity.extraData = mergeExtraData(entity.extraData, dto.extraData);
    }
    return this.save(entity);
  }

  /** INACTIVE đặt ngày nghỉ việc là hôm nay nếu chưa có; ACTIVE xóa ngày nghỉ việc. */
  setStatus(
    entity: EmployeeManagement,
    status: string,
    now = new Date(),
  ): Promise<EmployeeManagement> {
    entity.status = status;
    if (status === 'INACTIVE' && !entity.leaveDate) entity.leaveDate = now;
    if (status === 'ACTIVE') entity.leaveDate = null;
    return this.save(entity);
  }

  softDelete(entity: EmployeeManagement): Promise<EmployeeManagement> {
    entity.isDeleted = true;
    return this.save(entity);
  }

  /** Dịch lỗi ràng buộc DB (đua ghi đồng thời, chi nhánh không tồn tại) sang lỗi 4xx. */
  private async save(entity: EmployeeManagement): Promise<EmployeeManagement> {
    try {
      return await this.repo.save(entity);
    } catch (error) {
      const code = (error as { driverError?: { code?: string } }).driverError
        ?.code;
      if (error instanceof QueryFailedError && code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Mã nhân viên hoặc CCCD đã tồn tại');
      }
      if (error instanceof QueryFailedError && code === PG_FK_VIOLATION) {
        throw new BadRequestException('Chi nhánh không tồn tại');
      }
      throw error;
    }
  }
}
