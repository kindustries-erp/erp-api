import { Injectable } from '@nestjs/common';
import { StockVoucherActor } from '@/v2/core/inventory-movements-core';
import { StockVoucherResponseDto } from '@/v2/core/inventory-movements-core';
import {
  QueryStockVoucherDto,
  StockVoucherListResponseDto,
  toVoucherSummaryResponse,
} from '@/v2/core/inventory-movements-core';
import { toVoucherResponse } from '@/v2/core/inventory-movements-core';
import { CreateInventoryMovementsGarageAdjustmentDto } from './dto/create-inventory-movements-garage-adjustment.dto';
import { UpdateInventoryMovementsGarageAdjustmentDto } from './dto/update-inventory-movements-garage-adjustment.dto';
import { InventoryMovementsGarageAdjustmentCommandService } from './services/inventory-movements-garage-adjustment-command.service';
import { InventoryMovementsGarageAdjustmentQueryService } from './services/inventory-movements-garage-adjustment-query.service';

/** Facade phiếu điều chỉnh kho Garage: ghép đọc và ghi, trả về DTO phản hồi (không trả entity). */
@Injectable()
export class InventoryMovementsGarageAdjustmentsService {
  constructor(
    private readonly query: InventoryMovementsGarageAdjustmentQueryService,
    private readonly command: InventoryMovementsGarageAdjustmentCommandService,
  ) {}

  async list(
    params: QueryStockVoucherDto,
  ): Promise<StockVoucherListResponseDto> {
    const { items, pagination } = await this.query.findAll(params);
    return { items: items.map(toVoucherSummaryResponse), pagination };
  }

  nextVoucherNo(voucherDate?: string) {
    return this.query.nextVoucherNo(voucherDate);
  }

  async findOne(id: string): Promise<StockVoucherResponseDto> {
    const { header, lines } = await this.query.findOne(id);
    return toVoucherResponse(header, lines);
  }

  async create(
    actor: StockVoucherActor,
    dto: CreateInventoryMovementsGarageAdjustmentDto,
  ) {
    const voucherNo =
      dto.voucherNo?.trim() ||
      (await this.query.nextVoucherNo(dto.voucherDate));
    const saved = await this.command.createDraft(actor, { ...dto, voucherNo });
    return {
      message: 'Tạo phiếu điều chỉnh kho thành công',
      data: await this.findOne(saved.id),
    };
  }

  async update(id: string, dto: UpdateInventoryMovementsGarageAdjustmentDto) {
    await this.command.updateDraft(id, dto);
    return {
      message: 'Cập nhật phiếu điều chỉnh kho thành công',
      data: await this.findOne(id),
    };
  }

  async post(id: string, actor: StockVoucherActor) {
    await this.command.transition(id, 'post', actor);
    return {
      message: 'Ghi sổ phiếu điều chỉnh kho thành công',
      data: await this.findOne(id),
    };
  }

  async cancel(id: string, actor: StockVoucherActor, reason?: string | null) {
    await this.command.transition(id, 'cancel', actor, reason ?? null);
    return {
      message: 'Hủy phiếu điều chỉnh kho thành công',
      data: await this.findOne(id),
    };
  }

  async remove(id: string) {
    await this.command.softDelete(id);
    return { message: 'Xóa phiếu điều chỉnh kho thành công' };
  }
}
