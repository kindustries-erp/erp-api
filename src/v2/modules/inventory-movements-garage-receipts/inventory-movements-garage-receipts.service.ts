import { Injectable } from '@nestjs/common';
import { StockVoucherActor } from '@/v2/core/inventory-movements-core';
import { StockVoucherResponseDto } from '@/v2/core/inventory-movements-core';
import { toVoucherResponse } from '@/v2/core/inventory-movements-core';
import { CreateInventoryMovementsGarageReceiptDto } from './dto/create-inventory-movements-garage-receipt.dto';
import { UpdateInventoryMovementsGarageReceiptDto } from './dto/update-inventory-movements-garage-receipt.dto';
import { InventoryMovementsGarageReceiptCommandService } from './services/inventory-movements-garage-receipt-command.service';
import { InventoryMovementsGarageReceiptQueryService } from './services/inventory-movements-garage-receipt-query.service';

/** Facade phiếu nhập kho Garage: ghép đọc và ghi, trả về DTO phản hồi (không trả entity). */
@Injectable()
export class InventoryMovementsGarageReceiptsService {
  constructor(
    private readonly query: InventoryMovementsGarageReceiptQueryService,
    private readonly command: InventoryMovementsGarageReceiptCommandService,
  ) {}

  list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }) {
    return this.query.findAll(params);
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
    dto: CreateInventoryMovementsGarageReceiptDto,
  ) {
    const voucherNo =
      dto.voucherNo?.trim() ||
      (await this.query.nextVoucherNo(dto.voucherDate));
    const saved = await this.command.createDraft(actor, { ...dto, voucherNo });
    return {
      message: 'Tạo phiếu nhập kho thành công',
      data: await this.findOne(saved.id),
    };
  }

  async update(id: string, dto: UpdateInventoryMovementsGarageReceiptDto) {
    await this.command.updateDraft(id, dto);
    return {
      message: 'Cập nhật phiếu nhập kho thành công',
      data: await this.findOne(id),
    };
  }

  async post(id: string, actor: StockVoucherActor) {
    await this.command.transition(id, 'post', actor);
    return {
      message: 'Ghi sổ phiếu nhập kho thành công',
      data: await this.findOne(id),
    };
  }

  async cancel(id: string, actor: StockVoucherActor, reason?: string | null) {
    await this.command.transition(id, 'cancel', actor, reason ?? null);
    return {
      message: 'Hủy phiếu nhập kho thành công',
      data: await this.findOne(id),
    };
  }

  async remove(id: string) {
    await this.command.softDelete(id);
    return { message: 'Xóa phiếu nhập kho thành công' };
  }
}
