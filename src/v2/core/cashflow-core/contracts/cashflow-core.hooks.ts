import type { EntityManager } from 'typeorm';
import type { CashflowForecastAction } from './cashflow-core.contract';

/** Token DI cho danh sách hook (multi-provider). Module đăng ký nhiều hook dưới cùng token. */
export const CASHFLOW_FORECAST_HOOKS = Symbol('CASHFLOW_FORECAST_HOOKS');

export interface CashflowForecastHookActor {
  id: string;
  roles: string[];
}

export interface CashflowForecastHookContext<H> {
  /** Transaction đang chạy. Hook ghi DB phải dùng manager này để cùng transaction. */
  manager: EntityManager;
  header: H;
  actor: CashflowForecastHookActor;
  /** Dữ liệu phụ do module truyền khi tạo (ví dụ dòng hàng). Chỉ có ở afterCreate. */
  input?: unknown;
}

export interface CashflowForecastTransitionContext<
  H,
> extends CashflowForecastHookContext<H> {
  action: CashflowForecastAction;
  from: string;
  to: string;
}

/**
 * Hook của lõi cashflow-core. Chạy trong cùng transaction với thao tác chính.
 * Lỗi ném ra từ hook sẽ hủy toàn bộ thao tác. Lõi không import module nào, module đăng ký hook vào lõi.
 */
export interface CashflowForecastHook<H> {
  readonly name: string;
  afterCreate?(context: CashflowForecastHookContext<H>): Promise<void> | void;
  afterTransition?(
    context: CashflowForecastTransitionContext<H>,
  ): Promise<void> | void;
}
