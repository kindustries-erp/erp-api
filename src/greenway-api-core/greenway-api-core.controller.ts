import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  UseGuards,
  Param,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { GreenwayBranch } from './entities/gw_branch.entity';
import { GreenwayCase } from './entities/gw_case.entity';
import { GreenwayReceivable } from './entities/gw_receivable.entity';
import { GreenwayPayable } from './entities/gw_payable.entity';
import { GreenwayCaseService } from './entities/gw_case_service.entity';
import { GreenwayCasePayment } from './entities/gw_case_payment.entity';
import { GreenwaySyncService } from './greenway-sync.service';
import { GreenwayClientService } from './greenway-client.service';
import { AuthGuard } from '@nestjs/passport'; // Assuming standard NestJS AuthGuard is used

@Controller('greenway')
// @UseGuards(AuthGuard('jwt')) // Optional: uncomment and configure based on global auth setup
export class GreenwayApiCoreController {
  constructor(
    @InjectRepository(GreenwayBranch)
    private branchRepo: Repository<GreenwayBranch>,
    @InjectRepository(GreenwayCase)
    private caseRepo: Repository<GreenwayCase>,
    @InjectRepository(GreenwayReceivable)
    private receivableRepo: Repository<GreenwayReceivable>,
    @InjectRepository(GreenwayPayable)
    private payableRepo: Repository<GreenwayPayable>,
    @InjectRepository(GreenwayCaseService)
    private caseServiceRepo: Repository<GreenwayCaseService>,
    @InjectRepository(GreenwayCasePayment)
    private casePaymentRepo: Repository<GreenwayCasePayment>,
    private syncService: GreenwaySyncService,
    private client: GreenwayClientService,
  ) {}

  @Get('branches')
  async getBranches() {
    return this.branchRepo.find({ order: { name: 'ASC' } });
  }

  @Get('cases')
  async getCases(
    @Headers('x-greenway-branch-id') branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
  ) {
    const query = this.caseRepo.createQueryBuilder('case');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('case.caseCode ILIKE :q', { q: `%${q}%` })
            .orWhere("case.rawData->>'licensePlate' ILIKE :q", { q: `%${q}%` })
            .orWhere("case.rawData->>'customerName' ILIKE :q", { q: `%${q}%` })
            .orWhere("case.rawData->>'customerCode' ILIKE :q", { q: `%${q}%` });
        }),
      );
    }

    query.orderBy('case.updatedAt', 'DESC');

    const take = parseInt(pageSize, 10) || 20;
    const skip = (parseInt(page, 10) - 1 || 0) * take;

    query.take(take).skip(skip);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      pagination: {
        page: parseInt(page, 10) || 1,
        pageSize: take,
        total,
      },
    };
  }

  @Post('sync/branches')
  async syncBranches() {
    await this.syncService.syncBranches();
    return { success: true, message: 'Branches synced successfully.' };
  }

  @Post('sync/cases')
  async syncCases(
    @Headers('x-greenway-branch-id') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-greenway-branch-id header' };
    }
    await this.syncService.syncCasesForBranch(branchId, from, to);
    return { success: true, message: 'Cases synced successfully.' };
  }

  @Post('sync/cases/:id/detail')
  async syncCaseDetail(
    @Headers('x-greenway-branch-id') branchId: string,
    @Param('id') id: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-greenway-branch-id header' };
    const data = await this.syncService.syncCaseDetail(id, branchId);
    return { success: true, data };
  }

  @Post('sync/receivables')
  async syncReceivables(
    @Headers('x-greenway-branch-id') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-greenway-branch-id header' };
    await this.syncService.syncReceivables(branchId, from, to);
    return { success: true, message: 'Receivables synced successfully.' };
  }

  @Post('sync/payables')
  async syncPayables(
    @Headers('x-greenway-branch-id') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-greenway-branch-id header' };
    await this.syncService.syncPayables(branchId, from, to);
    return { success: true, message: 'Payables synced successfully.' };
  }

  @Get('dashboard')
  async getDashboard(
    @Headers('x-greenway-branch-id') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-greenway-branch-id header' };
    return this.client.getDashboard(branchId, from, to);
  }

  @Get('receivables')
  async getReceivables(@Headers('x-greenway-branch-id') branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.receivableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('payables')
  async getPayables(@Headers('x-greenway-branch-id') branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.payableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('cases/:id/services')
  async getCaseServices(@Param('id') id: string) {
    return this.caseServiceRepo.find({ where: { caseExternalId: id } });
  }

  @Get('cases/:id/payments')
  async getCasePayments(@Param('id') id: string) {
    return this.casePaymentRepo.find({ where: { caseExternalId: id } });
  }
}
