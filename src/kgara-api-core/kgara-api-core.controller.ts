import { Controller, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';

// Re-export BranchId decorator for backward compatibility
export { BranchId } from './decorators/branch-id.decorator';

@Controller('greenway')
export class KgaraApiCoreController implements OnModuleInit {
  private readonly logger = new Logger(KgaraApiCoreController.name);

  constructor(
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
  ) {}

  async onModuleInit() {
    try {
      await this.settlementRepo.manager.query(`
        UPDATE kgara_cases c
        SET
          tien_da_thanh_toan = COALESCE(s.total_receipts, 0),
          tien_con_phai_thanh_toan = GREATEST(0, COALESCE(c.tien_co_thue, 0) - COALESCE(s.total_receipts, 0))
        FROM (
          SELECT case_id, SUM(amount) as total_receipts
          FROM kgara_case_settlements
          WHERE settlement_type = 'RECEIPT'
          GROUP BY case_id
        ) s
        WHERE c.id = s.case_id;
      `);
    } catch (e) {
      this.logger.warn(`Initial settlement balance sync: ${e}`);
    }
  }
}
