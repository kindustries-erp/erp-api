import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { nextDocumentNo } from '@/common/numbering/document-numbering';
import type {
  CaseMutationResponse,
  CaseResponse,
} from './dto/case-response.types';
import type { CaseServiceLineDto } from './dto/case-service-line.dto';
import type { CreateCaseDto, UpdateCaseDto } from './dto/case-write.dto';
import { CaseGarage } from './entities/case-garage.entity';
import type { CaseStatus } from './entities/case-garage.enums';
import { toCaseResponse } from './helpers/case-response.mapper';
import { CaseCommandService } from './services/case-command.service';
import { CaseLineCommandService } from './services/case-line-command.service';

const wrap = (message: string, c: CaseGarage): CaseMutationResponse => ({
  message,
  data: toCaseResponse(c),
});

/** Facade ghi vụ việc v2: luôn trả response DTO, không lộ entity. Đọc nằm ở các query service. */
@Injectable()
export class CasesGarageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly commands: CaseCommandService,
    private readonly lineCommands: CaseLineCommandService,
  ) {}

  async nextCode(): Promise<{ caseCode: string }> {
    const caseCode = await this.dataSource.transaction((m) =>
      nextDocumentNo(m, CaseGarage, 'caseCode', 'VV'),
    );
    return { caseCode };
  }

  async create(branch: string, dto: CreateCaseDto, actorId: string) {
    return wrap(
      'Đã tạo vụ việc',
      await this.commands.create(branch, dto, actorId),
    );
  }

  async update(branch: string, id: string, dto: UpdateCaseDto) {
    return wrap(
      'Đã cập nhật vụ việc',
      await this.commands.update(branch, id, dto),
    );
  }

  async updateStatus(branch: string, id: string, status: CaseStatus) {
    return wrap(
      'Đã đổi trạng thái',
      await this.commands.updateStatus(branch, id, status),
    );
  }

  async remove(branch: string, id: string): Promise<{ message: string }> {
    await this.commands.softDelete(branch, id);
    return { message: 'Đã xóa vụ việc' };
  }

  async addLine(branch: string, id: string, dto: CaseServiceLineDto) {
    return wrap(
      'Đã thêm hạng mục',
      await this.lineCommands.add(branch, id, dto),
    );
  }

  async replaceLine(
    branch: string,
    id: string,
    lineId: string,
    dto: CaseServiceLineDto,
  ) {
    return wrap(
      'Đã cập nhật hạng mục',
      await this.lineCommands.replace(branch, id, lineId, dto),
    );
  }

  async removeLine(branch: string, id: string, lineId: string) {
    return wrap(
      'Đã xóa hạng mục',
      await this.lineCommands.remove(branch, id, lineId),
    );
  }

  async updatePartsCost(
    branch: string,
    id: string,
    lineId: string,
    partsCost: number,
  ) {
    return wrap(
      'Đã cập nhật giá vốn phụ tùng',
      await this.lineCommands.updatePartsCost(branch, id, lineId, partsCost),
    );
  }
}

export type { CaseResponse };
