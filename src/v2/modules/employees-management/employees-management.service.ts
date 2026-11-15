import { Injectable } from '@nestjs/common';
import {
  CreateEmployeeManagementDto,
  EmployeesCoreService,
  QueryEmployeeManagementDto,
  UpdateEmployeeManagementDto,
  UpdateEmployeeStatusDto,
} from '@/v2/core/employees-core';

/** Facade của module Employees Management: controller chỉ gọi lớp này, nghiệp vụ nằm ở lõi. */
@Injectable()
export class EmployeesManagementService {
  constructor(private readonly core: EmployeesCoreService) {}

  findAll(dto: QueryEmployeeManagementDto) {
    return this.core.findAll(dto);
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.core.findColumnOptions(column, search, page, pageSize, filters);
  }

  getNextCode() {
    return this.core.getNextCode();
  }

  findOne(id: string) {
    return this.core.findOne(id);
  }

  getNationalId(id: string) {
    return this.core.getNationalId(id);
  }

  create(dto: CreateEmployeeManagementDto) {
    return this.core.create(dto);
  }

  update(id: string, dto: UpdateEmployeeManagementDto) {
    return this.core.update(id, dto);
  }

  updateStatus(id: string, dto: UpdateEmployeeStatusDto) {
    return this.core.updateStatus(id, dto);
  }

  remove(id: string) {
    return this.core.remove(id);
  }
}
