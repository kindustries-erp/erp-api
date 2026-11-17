import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { EmployeeManagement } from '../entities/employee-management.entity';
import { CreateEmployeeManagementDto } from '../dto/create-employee-management.dto';
import { UpdateEmployeeManagementDto } from '../dto/update-employee-management.dto';
import { UpdateEmployeeStatusDto } from '../dto/update-employee-status.dto';
import { QueryEmployeeManagementDto } from '../dto/query-employee-management.dto';
import { toEmployeeManagementResponse } from '../helpers/employee-management.mapper';
import {
  nextEmployeeCode,
  normalizeEmployeeCode,
} from '../helpers/employee-code.helper';
import { EmployeeCommandService } from './employee-command.service';
import { EmployeeQueryService } from './employee-query.service';

/** Facade của lõi: điều phối query/command, sinh mã và luôn trả response DTO, không lộ entity. */
@Injectable()
export class EmployeesCoreService {
  constructor(
    private readonly query: EmployeeQueryService,
    private readonly command: EmployeeCommandService,
  ) {}

  async findAll(dto: QueryEmployeeManagementDto) {
    const page = await this.query.findAll(dto);
    const linked = await this.query.findLinkedUsers(
      page.items.map((item) => item.userId ?? ''),
    );
    return toPaginatedResult(
      page.items.map((item) =>
        toEmployeeManagementResponse(
          item,
          linked.get(item.userId ?? '') ?? null,
        ),
      ),
      page.page,
      page.pageSize,
      page.total,
      page.summaries,
    );
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  /** Mã kế tiếp (NV-001...), dùng để điền sẵn khi tạo mới. */
  async getNextCode(): Promise<{ nextCode: string }> {
    return { nextCode: nextEmployeeCode(await this.query.findAllCodes()) };
  }

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: 'Lấy thông tin thành công',
      data: await this.toResponse(entity),
    };
  }

  /** CCCD đầy đủ; controller chỉ cho người có quyền cập nhật. */
  async getNationalId(id: string) {
    const value = await this.query.findNationalId(id);
    if (value === undefined) this.throwNotFound(id);
    return { message: 'Lấy thông tin thành công', data: { nationalId: value } };
  }

  async create(dto: CreateEmployeeManagementDto) {
    const employeeCode = dto.employeeCode?.trim()
      ? normalizeEmployeeCode(dto.employeeCode)
      : nextEmployeeCode(await this.query.findAllCodes());
    await this.command.assertCodeAvailable(employeeCode);
    if (dto.nationalId)
      await this.command.assertNationalIdAvailable(dto.nationalId);

    const created = await this.command.create({ ...dto, employeeCode });
    // Nạp lại để response có thông tin chi nhánh
    const entity = await this.requireById(created.id);
    return { message: 'Tạo thành công', data: await this.toResponse(entity) };
  }

  async update(id: string, dto: UpdateEmployeeManagementDto) {
    const entity = await this.requireById(id);
    const employeeCode = dto.employeeCode?.trim()
      ? normalizeEmployeeCode(dto.employeeCode)
      : undefined;
    if (employeeCode) await this.command.assertCodeAvailable(employeeCode, id);
    if (dto.nationalId) {
      await this.command.assertNationalIdAvailable(dto.nationalId, id);
    }

    await this.command.update(entity, { ...dto, employeeCode });
    const reloaded = await this.requireById(id);
    return {
      message: 'Cập nhật thành công',
      data: await this.toResponse(reloaded),
    };
  }

  async updateStatus(id: string, dto: UpdateEmployeeStatusDto) {
    const entity = await this.requireById(id);
    await this.command.setStatus(entity, dto.status);
    const reloaded = await this.requireById(id);
    return {
      message: 'Cập nhật trạng thái thành công',
      data: await this.toResponse(reloaded),
    };
  }

  async remove(id: string) {
    const entity = await this.requireById(id);
    if (entity.userId) {
      throw new ConflictException(
        'Nhân viên đang liên kết tài khoản, hãy gỡ liên kết trước khi xóa',
      );
    }
    const saved = await this.command.softDelete(entity);
    return { message: 'Xóa thành công', data: await this.toResponse(saved) };
  }

  private async toResponse(entity: EmployeeManagement) {
    const linked = await this.query.findLinkedUsers(
      entity.userId ? [entity.userId] : [],
    );
    return toEmployeeManagementResponse(
      entity,
      entity.userId ? (linked.get(entity.userId) ?? null) : null,
    );
  }

  private async requireById(id: string): Promise<EmployeeManagement> {
    const entity = await this.query.findById(id);
    if (!entity) this.throwNotFound(id);
    return entity as EmployeeManagement;
  }

  private throwNotFound(id: string): never {
    throw new NotFoundException(`Không tìm thấy nhân viên với id ${id}`);
  }
}
