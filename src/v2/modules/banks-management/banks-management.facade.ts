import { Injectable } from '@nestjs/common';
import { toPagedList } from '@/common/utils/paginated-result';
import { CreateBankManagementDto } from './dto/create-bank-management.dto';
import { UpdateBankManagementDto } from './dto/update-bank-management.dto';
import { BankManagementQueryDto } from './dto/bank-management-query.dto';
import { BankManagementListResponseDto } from './dto/bank-management-list-response.dto';
import { BankManagementResponseDto } from './dto/bank-management-response.dto';
import { toBankManagementResponse } from './helpers/bank-management.mapper';
import { BanksManagementQueryService } from './services/banks-management-query.service';
import { BanksManagementCommandService } from './services/banks-management-command.service';
import {
  BanksManagementSyncService,
  SyncResult,
} from './services/banks-management-sync.service';
import {
  BanksManagementLogoService,
  BankLogoPayload,
} from './services/banks-management-logo.service';
import { ColumnOptionsQueryDto } from './dto/column-options-query.dto';

@Injectable()
export class BanksManagementFacade {
  constructor(
    private readonly queryService: BanksManagementQueryService,
    private readonly commandService: BanksManagementCommandService,
    private readonly syncService: BanksManagementSyncService,
    private readonly logoService: BanksManagementLogoService,
  ) {}

  async findAll(
    query: BankManagementQueryDto,
  ): Promise<BankManagementListResponseDto> {
    const res = await this.queryService.findAll(query);
    return toPagedList(
      res.items.map(toBankManagementResponse),
      res.page,
      res.pageSize,
      res.total,
    );
  }

  async findById(id: string): Promise<BankManagementResponseDto | null> {
    const item = await this.queryService.findById(id);
    return item ? toBankManagementResponse(item) : null;
  }

  async findByBin(bin: string): Promise<BankManagementResponseDto | null> {
    const item = await this.queryService.findByBin(bin);
    return item ? toBankManagementResponse(item) : null;
  }

  async create(
    dto: CreateBankManagementDto,
  ): Promise<BankManagementResponseDto> {
    const created = await this.commandService.create(dto);
    return toBankManagementResponse(created);
  }

  async update(
    id: string,
    dto: UpdateBankManagementDto,
  ): Promise<BankManagementResponseDto> {
    const updated = await this.commandService.update(id, dto);
    return toBankManagementResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.commandService.softDelete(id);
  }

  async syncFromVietQr(): Promise<SyncResult> {
    return this.syncService.syncFromVietQr();
  }

  async getLogoBuffer(code: string): Promise<BankLogoPayload> {
    return this.logoService.getLogoBuffer(code);
  }

  findColumnOptions(dto: ColumnOptionsQueryDto) {
    return this.queryService.findColumnOptions(
      dto.column,
      dto.search,
      dto.page ?? 1,
      dto.pageSize ?? 20,
      dto.filters,
    );
  }
}
