import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { nextDocumentNo } from '@/common/numbering/document-numbering';
import { assertValidExtraData } from '@/v2/core/base-core/helpers/extra-data.util';
import { runInOptionalTransaction } from '@/v2/core/base-core/helpers/run-in-optional-transaction.util';
import type { CreateCaseDto, UpdateCaseDto } from '../dto/case-write.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import {
  CaseOrigin,
  CaseStatus,
  DEFAULT_CASE_ACCOUNT_KEY,
} from '../entities/case-garage.enums';
import {
  assertDeletable,
  assertHeaderPatchAllowed,
  assertStatusEditable,
} from '../helpers/case-origin.guard';
import { canTransition, statusToKgaraCode } from '../helpers/kgara-status.map';
import { CaseKgaraMirrorService } from './case-kgara-mirror.service';
import { CaseLineWriter } from './case-line-writer.service';

const CASE_NO_PREFIX = 'VV';
const DATE_KEYS = ['issuedAt', 'receivedAt', 'completedAt', 'deliveredAt'];

/** Chuyển chuỗi ngày ISO của DTO thành Date; bỏ `services` (xử lý riêng). */
function headerFields(dto: Record<string, unknown>): Partial<CaseGarage> {
  const { services: _s, ...rest } = dto;
  for (const k of DATE_KEYS) {
    if (typeof rest[k] === 'string') rest[k] = new Date(rest[k] as string);
  }
  return rest as Partial<CaseGarage>;
}

function rethrowUnique(e: unknown): never {
  if ((e as { code?: string })?.code === '23505') {
    throw new ConflictException('Số chứng từ đã tồn tại trong chi nhánh này.');
  }
  throw e;
}

/** Ghi header vụ việc v2. Mọi truy vấn kèm `branchExternalId` (cách ly chi nhánh, AC-8). */
@Injectable()
export class CaseCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly lines: CaseLineWriter,
    private readonly mirror: CaseKgaraMirrorService,
  ) {}

  /** Tìm vụ việc đang hoạt động của đúng chi nhánh; khác chi nhánh coi như không tồn tại. */
  async findOwned(
    manager: EntityManager,
    branchExternalId: string,
    id: string,
    lock = false,
  ): Promise<CaseGarage> {
    const found = await manager.findOne(CaseGarage, {
      where: {
        id,
        branchExternalId,
        isDeleted: false,
        externalDeletedAt: IsNull(),
      },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!found) throw new NotFoundException('Không tìm thấy vụ việc.');
    return found;
  }

  async create(
    branchExternalId: string,
    dto: CreateCaseDto,
    actorId: string,
    outer?: EntityManager,
  ): Promise<CaseGarage> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    return runInOptionalTransaction(this.dataSource, outer, async (m) => {
      const caseCode =
        dto.caseCode?.trim() ||
        (await nextDocumentNo(m, CaseGarage, 'caseCode', CASE_NO_PREFIX));
      const header = m.create(CaseGarage, {
        ...headerFields(dto as unknown as Record<string, unknown>),
        caseCode,
        branchExternalId,
        accountKey: DEFAULT_CASE_ACCOUNT_KEY,
        origin: CaseOrigin.NATIVE,
        status: CaseStatus.INTAKE,
        kgaraStatusCode: statusToKgaraCode(CaseStatus.INTAKE),
        createdBy: actorId || null,
        extraData: dto.extraData ?? {},
      });
      try {
        const saved = await m.save(CaseGarage, header);
        if (dto.services?.length) {
          await this.lines.replaceAll(m, saved, dto.services);
        }
        return await this.reload(m, saved.id);
      } catch (e) {
        return rethrowUnique(e);
      }
    });
  }

  async update(
    branchExternalId: string,
    id: string,
    dto: UpdateCaseDto,
    outer?: EntityManager,
  ): Promise<CaseGarage> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    return runInOptionalTransaction(this.dataSource, outer, async (m) => {
      const current = await this.findOwned(m, branchExternalId, id, true);
      const patch = dto as unknown as Record<string, unknown>;
      assertHeaderPatchAllowed(current.origin, patch);
      const fields = headerFields(patch);
      try {
        await m.update(CaseGarage, { id }, fields as never);
        if (current.origin === CaseOrigin.KGARA_SYNC) {
          await this.mirror.mirrorCase(m, id, fields);
        } else if (dto.services !== undefined) {
          await this.lines.replaceAll(m, current, dto.services);
        }
      } catch (e) {
        rethrowUnique(e);
      }
      return this.reload(m, id);
    });
  }

  async updateStatus(
    branchExternalId: string,
    id: string,
    status: CaseStatus,
  ): Promise<CaseGarage> {
    return this.dataSource.transaction(async (m) => {
      const current = await this.findOwned(m, branchExternalId, id, true);
      assertStatusEditable(current.origin);
      if (!canTransition(current.status, status)) {
        throw new BadRequestException(
          `Không chuyển được trạng thái ${current.status} → ${status}.`,
        );
      }
      await m.update(CaseGarage, { id }, {
        status,
        kgaraStatusCode: statusToKgaraCode(status),
        ...(status === CaseStatus.COMPLETED ? { completedAt: new Date() } : {}),
      } as never);
      return this.reload(m, id);
    });
  }

  async softDelete(branchExternalId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const current = await this.findOwned(m, branchExternalId, id, true);
      assertDeletable(current.origin);
      await m.update(CaseGarage, { id }, { isDeleted: true } as never);
    });
  }

  reload(m: EntityManager, id: string): Promise<CaseGarage> {
    return m.findOneOrFail(CaseGarage, {
      where: { id },
      relations: ['services'],
    });
  }
}
