import { Injectable } from '@nestjs/common';
import { AbstractDebtSettlementService } from '@/v2/core/debts-core';
import { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import { DebtGarage } from '../entities/debt-garage.entity';

/** Cài `DebtSettlementPort` cho sổ nợ garage: điểm duy nhất đổi số dư `debts_garage`. */
@Injectable()
export class GarageDebtSettlementService extends AbstractDebtSettlementService {
  protected readonly debtTarget = DebtGarage;
  protected readonly allocationTarget = DebtAllocationGarage;
}
