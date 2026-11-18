import { Injectable } from '@nestjs/common';
import { AbstractDebtOriginService } from '@/v2/core/debts-core';
import { DebtGarage } from '../entities/debt-garage.entity';

/** Cài `DebtOriginPort` cho sổ nợ garage (`debts_garage`). */
@Injectable()
export class GarageDebtOriginService extends AbstractDebtOriginService {
  protected readonly debtTarget = DebtGarage;
}
