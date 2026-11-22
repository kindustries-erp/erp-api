import type { CostingMethod } from '../contracts/inventory-movements-core.contract';
import { fifoStrategy } from './fifo.strategy';
import type { CostingStrategy } from './costing.types';
import { weightedAvgStrategy } from './weighted-avg.strategy';

const STRATEGIES: Record<CostingMethod, CostingStrategy> = {
  WEIGHTED_AVG: weightedAvgStrategy,
  FIFO: fifoStrategy,
};

/** Chọn chiến lược giá vốn theo cấu hình ledger. Chiến lược không giữ trạng thái nên dùng chung. */
export function costingStrategyFor(method: CostingMethod): CostingStrategy {
  const strategy = STRATEGIES[method];
  if (!strategy) {
    throw new Error(`Phương pháp giá vốn không hỗ trợ: ${method}`);
  }
  return strategy;
}
