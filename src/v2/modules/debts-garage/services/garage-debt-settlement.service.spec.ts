import {
  AbstractDebtOriginService,
  AbstractDebtSettlementService,
} from '@/v2/core/debts-core';
import { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import { DebtGarage } from '../entities/debt-garage.entity';
import { GarageDebtOriginService } from './garage-debt-origin.service';
import { GarageDebtSettlementService } from './garage-debt-settlement.service';

describe('cài đặt cổng công nợ cho garage', () => {
  it('settlement trỏ đúng bảng sổ nợ và phân bổ garage', () => {
    const s = new GarageDebtSettlementService() as unknown as Record<
      string,
      unknown
    >;
    expect(new GarageDebtSettlementService()).toBeInstanceOf(
      AbstractDebtSettlementService,
    );
    expect(s.debtTarget).toBe(DebtGarage);
    expect(s.allocationTarget).toBe(DebtAllocationGarage);
  });

  it('origin trỏ đúng bảng sổ nợ', () => {
    const o = new GarageDebtOriginService() as unknown as Record<
      string,
      unknown
    >;
    expect(new GarageDebtOriginService()).toBeInstanceOf(
      AbstractDebtOriginService,
    );
    expect(o.debtTarget).toBe(DebtGarage);
  });
});
