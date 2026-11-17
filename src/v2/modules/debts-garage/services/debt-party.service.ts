import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AssignDebtPartyDto } from '../dto/assign-debt-party.dto';
import type { DebtLedgerRow } from '../dto/debt-ledger.types';
import { DebtGarage } from '../entities/debt-garage.entity';
import { toDebtLedgerRow } from '../helpers/debt-ledger-row.mapper';

/** Loại đối tượng nợ được gán tay (khách hàng lấy theo vụ việc, không gán). */
const ASSIGNABLE_PARTY_TYPES = ['INSURER', 'SUPPLIER'];

/** Gán hãng bảo hiểm / NCC cho dòng nợ. Không đụng số tiền; khóa dòng để không ghi chồng với phân bổ. */
@Injectable()
export class DebtPartyService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  assignParty(
    branchId: string,
    debtId: string,
    dto: AssignDebtPartyDto,
  ): Promise<DebtLedgerRow> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DebtGarage);
      const debt = await repo
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where(
          'd.id = :debtId AND d.branchExternalId = :branchId AND d.isDeleted = false',
          { debtId, branchId },
        )
        .getOne();
      if (!debt) throw new NotFoundException('Không có khoản nợ');
      if (!ASSIGNABLE_PARTY_TYPES.includes(debt.partyType)) {
        throw new ConflictException('Chỉ gán được hãng bảo hiểm hoặc NCC');
      }
      if (debt.status === 'VOID') {
        throw new ConflictException('Khoản nợ đã hủy');
      }
      debt.partyCode = dto.partyCode.trim();
      debt.partyName = dto.partyName?.trim() || null;
      debt.partnerId = dto.partnerId ?? null;
      return toDebtLedgerRow(await repo.save(debt));
    });
  }
}
