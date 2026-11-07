import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  AbstractCashflowForecastCommandService,
  CASHFLOW_FORECAST_HOOKS,
  CashflowAllocation,
  CashflowForecast,
  CashflowForecastAction,
  CashflowForecastActor,
  CashflowForecastHook,
} from '@/v2/core/cashflow-core';
import {
  GARAGE_FORECAST_PURCHASE_KIND,
  GarageForecastCreateInput,
  GarageForecastLineInput,
} from '../contracts/garage-forecast.types';

export type GarageForecastKind =
  | 'PURCHASE'
  | 'COMMISSION'
  | 'CASE_RECEIVABLE'
  | 'OTHER';

export interface CreateGarageForecastCommand {
  direction: 'IN' | 'OUT';
  kind: GarageForecastKind;
  amount?: number;
  plannedDate?: string | null;
  branchId?: string | null;
  partnerName?: string | null;
  note?: string | null;
  caseId?: string | null;
  licensePlate?: string | null;
  paymentContent?: string | null;
  lines?: GarageForecastLineInput[];
  /** Lấy từ cấu hình duyệt (facade). Mặc định khi không truyền: dự chi cần duyệt. */
  requiresApproval?: boolean;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ghi dự thu/dự chi Garage. Kế thừa lõi: khóa dòng, quy tắc duyệt, nhật ký.
 * Riêng ở đây: sinh mã, tính tiền dự chi mua hàng theo dòng, chặn hủy khi đã phân bổ.
 */
@Injectable()
export class GarageForecastCommandService extends AbstractCashflowForecastCommandService<CashflowForecast> {
  protected readonly headerEntity = CashflowForecast;
  protected readonly docType = 'CASHFLOW_FORECAST';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    @Inject(CASHFLOW_FORECAST_HOOKS)
    hooks: CashflowForecastHook<CashflowForecast>[],
  ) {
    super(dataSource, events, hooks);
  }

  /**
   * Tạo dự thu/dự chi Garage. Dự chi mua hàng phải có dòng hàng, tiền = tổng dòng.
   * Cờ duyệt do facade đọc từ cấu hình approval-core và chép vào dòng.
   */
  async createForecast(
    actor: CashflowForecastActor,
    command: CreateGarageForecastCommand,
  ): Promise<CashflowForecast> {
    const { amount, lines } = this.resolveAmountAndLines(command);
    const input: GarageForecastCreateInput = {
      caseId: command.caseId ?? null,
      licensePlate: command.licensePlate ?? null,
      paymentContent: command.paymentContent ?? null,
      lines,
    };
    return this.createDraft(
      actor,
      {
        code: this.nextCode(),
        direction: command.direction,
        kind: command.kind,
        source: 'MANUAL',
        amount,
        plannedDate: command.plannedDate ?? null,
        branchId: command.branchId ?? null,
        partnerName: command.partnerName ?? null,
        note: command.note ?? null,
        requiresApproval:
          command.requiresApproval ?? command.direction === 'OUT',
      },
      input,
    );
  }

  private resolveAmountAndLines(command: CreateGarageForecastCommand): {
    amount: number;
    lines: Array<GarageForecastLineInput & { amount: number }>;
  } {
    const rawLines = command.lines ?? [];
    if (command.kind !== GARAGE_FORECAST_PURCHASE_KIND) {
      if (rawLines.length > 0) {
        throw new BadRequestException('Chỉ dự chi mua hàng mới có dòng hàng');
      }
      if (command.amount === undefined || command.amount < 0) {
        throw new BadRequestException('Số tiền không hợp lệ');
      }
      return { amount: roundMoney(command.amount), lines: [] };
    }

    if (command.direction !== 'OUT') {
      throw new BadRequestException('Đề nghị mua hàng phải là dự chi');
    }
    if (rawLines.length === 0) {
      throw new BadRequestException('Dự chi mua hàng bắt buộc có dòng hàng');
    }
    const lines = rawLines.map((line) => {
      if (!(line.qtyRequested > 0) || line.unitPrice < 0) {
        throw new BadRequestException(
          `Dòng hàng "${line.itemName}" có số lượng hoặc đơn giá không hợp lệ`,
        );
      }
      return {
        ...line,
        amount: roundMoney(line.qtyRequested * line.unitPrice),
      };
    });
    const amount = roundMoney(
      lines.reduce((sum, line) => sum + line.amount, 0),
    );
    return { amount, lines };
  }

  /** Mã dạng DC-GARA-YYYYMMDD-XXXXXX. Phần ngẫu nhiên tránh trùng; chưa có bộ đếm tuần tự. */
  private nextCode(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `DC-GARA-${today}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /** Không hủy dự chi đã có phân bổ thanh toán. */
  protected async beforeTransition(
    manager: EntityManager,
    header: CashflowForecast,
    action: CashflowForecastAction,
  ): Promise<void> {
    if (action !== 'cancel') return;
    const allocated = await manager.count(CashflowAllocation, {
      where: { forecastId: header.id },
    });
    if (allocated > 0) {
      throw new ConflictException(
        'Chứng từ đã có phân bổ thanh toán, không thể hủy',
      );
    }
  }
}
