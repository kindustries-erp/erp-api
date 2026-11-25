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
import { CaseProgressCommandService } from './services/case-progress-command.service';
import { CaseRevertService } from './services/case-revert.service';
import type { UpdateCaseProgressDto } from './dto/case-progress.dto';

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
    private readonly reverts: CaseRevertService,
    private readonly progress: CaseProgressCommandService,
  ) {}

  async nextCode(): Promise<{ caseCode: string }> {
    const caseCode = await this.dataSource.transaction((m) =>
      nextDocumentNo(m, CaseGarage, 'caseCode', 'VV'),
    );
    return { caseCode };
  }

  async create(
    branch: string | undefined,
    dto: CreateCaseDto,
    actorId: string,
  ) {
    return wrap(
      'Đã tạo vụ việc',
      await this.commands.create(branch, dto, actorId),
    );
  }

  async update(branch: string | undefined, id: string, dto: UpdateCaseDto) {
    return wrap(
      'Đã cập nhật vụ việc',
      await this.commands.update(branch, id, dto),
    );
  }

  async updateStatus(
    branch: string | undefined,
    id: string,
    status: CaseStatus,
    actorId = '',
  ) {
    return wrap(
      'Đã đổi trạng thái',
      await this.commands.updateStatus(branch, id, status, actorId),
    );
  }

  async remove(
    branch: string | undefined,
    id: string,
  ): Promise<{ message: string }> {
    await this.commands.softDelete(branch, id);
    return { message: 'Đã xóa vụ việc' };
  }

  async addLine(
    branch: string | undefined,
    id: string,
    dto: CaseServiceLineDto,
  ) {
    return wrap(
      'Đã thêm hạng mục',
      await this.lineCommands.add(branch, id, dto),
    );
  }

  async replaceLine(
    branch: string | undefined,
    id: string,
    lineId: string,
    dto: CaseServiceLineDto,
  ) {
    return wrap(
      'Đã cập nhật hạng mục',
      await this.lineCommands.replace(branch, id, lineId, dto),
    );
  }

  async removeLine(branch: string | undefined, id: string, lineId: string) {
    return wrap(
      'Đã xóa hạng mục',
      await this.lineCommands.remove(branch, id, lineId),
    );
  }

  async updateProgress(
    branch: string | undefined,
    id: string,
    dto: UpdateCaseProgressDto,
    actorId: string,
  ) {
    return wrap(
      'Đã cập nhật tiến độ',
      await this.progress.update(branch, id, dto, actorId),
    );
  }

  async revertCase(
    branch: string | undefined,
    id: string,
    fields?: string[],
    actorId = '',
  ) {
    return wrap(
      'Đã về giá trị KGara',
      await this.reverts.revertCase(branch, id, fields, actorId),
    );
  }

  async revertLine(
    branch: string | undefined,
    id: string,
    lineId: string,
    fields?: string[],
  ) {
    return wrap(
      'Đã về giá trị KGara',
      await this.reverts.revertLine(branch, id, lineId, fields),
    );
  }

  async updatePartsCost(
    branch: string | undefined,
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
