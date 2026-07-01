import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GreenwayBranch } from './entities/gw_branch.entity';
import { GreenwayCase } from './entities/gw_case.entity';
import { GreenwayClientService } from './greenway-client.service';
import { GreenwayReceivable } from './entities/gw_receivable.entity';
import { GreenwayPayable } from './entities/gw_payable.entity';
import { GreenwayCaseService } from './entities/gw_case_service.entity';
import { GreenwayCasePayment } from './entities/gw_case_payment.entity';

@Injectable()
export class GreenwaySyncService {
  private readonly logger = new Logger(GreenwaySyncService.name);

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
    private client: GreenwayClientService,
  ) {}

  async syncBranches(): Promise<void> {
    this.logger.log('Syncing Greenway branches...');
    const branches = await this.client.getBranches();

    for (const b of branches) {
      let branch = await this.branchRepo.findOne({
        where: { externalId: b.DonViID },
      });
      if (!branch) {
        branch = new GreenwayBranch();
        branch.externalId = b.DonViID;
      }
      branch.code = b.MaSo;
      branch.name = b.TenDonVi;
      await this.branchRepo.save(branch);
    }
    this.logger.log('Finished syncing branches.');
  }

  async syncCasesForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(`Syncing Greenway cases for branch ${branchExternalId}...`);
    const response = await this.client.getCases(branchExternalId, from, to);
    const cases = response?.data || [];

    for (const c of cases) {
      let gwCase = await this.caseRepo.findOne({
        where: { externalId: c.caseId || c.id },
      });
      if (!gwCase) {
        gwCase = new GreenwayCase();
        gwCase.externalId = c.caseId || c.id;
      }
      gwCase.caseCode = c.caseCode;
      gwCase.caseName = c.caseName;
      gwCase.statusCode = c.statusCode;
      gwCase.statusName = c.statusName;
      gwCase.totalAmount = c.totalAmount;
      gwCase.paidAmount = c.paidAmount;
      gwCase.branchExternalId = branchExternalId;
      gwCase.rawData = c;

      await this.caseRepo.save(gwCase);
    }
    this.logger.log(`Finished syncing cases for branch ${branchExternalId}.`);
  }

  async syncReceivables(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing Greenway receivables for branch ${branchExternalId}...`,
    );
    const response = await this.client.getReceivables(
      branchExternalId,
      from,
      to,
    );
    const receivables = response?.data || [];

    for (const r of receivables) {
      let rec = await this.receivableRepo.findOne({
        where: { externalId: r.id },
      });
      if (!rec) {
        rec = new GreenwayReceivable();
        rec.externalId = r.id;
      }
      rec.code = r.code || r.receiptCode;
      rec.name = r.name || r.customerName;
      rec.totalAmount = r.totalAmount;
      rec.paidAmount = r.paidAmount;
      rec.branchExternalId = branchExternalId;
      rec.rawData = r;

      await this.receivableRepo.save(rec);
    }
    this.logger.log(
      `Finished syncing receivables for branch ${branchExternalId}.`,
    );
  }

  async syncPayables(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing Greenway payables for branch ${branchExternalId}...`,
    );
    const response = await this.client.getPayables(branchExternalId, from, to);
    const payables = response?.data || [];

    for (const p of payables) {
      let pay = await this.payableRepo.findOne({ where: { externalId: p.id } });
      if (!pay) {
        pay = new GreenwayPayable();
        pay.externalId = p.id;
      }
      pay.code = p.code || p.paymentCode;
      pay.name = p.name || p.supplierName;
      pay.totalAmount = p.totalAmount;
      pay.paidAmount = p.paidAmount;
      pay.branchExternalId = branchExternalId;
      pay.rawData = p;

      await this.payableRepo.save(pay);
    }
    this.logger.log(
      `Finished syncing payables for branch ${branchExternalId}.`,
    );
  }

  async syncCaseDetail(caseId: string, branchExternalId: string): Promise<any> {
    this.logger.log(`Syncing Greenway case detail for case ${caseId}...`);
    const response = await this.client.getCaseDetail(caseId, branchExternalId);
    const caseData = response?.data;
    if (!caseData) return null;

    // Update case if exists
    let gwCase = await this.caseRepo.findOne({ where: { externalId: caseId } });
    if (!gwCase) {
      gwCase = new GreenwayCase();
      gwCase.externalId = caseId;
    }
    gwCase.caseCode = caseData.caseCode;
    gwCase.caseName = caseData.caseName;
    gwCase.statusCode = caseData.statusCode;
    gwCase.statusName = caseData.statusName;
    gwCase.totalAmount = caseData.totalAmount;
    gwCase.paidAmount = caseData.paidAmount;
    gwCase.branchExternalId = branchExternalId;
    gwCase.rawData = caseData;
    await this.caseRepo.save(gwCase);

    // Sync Services
    if (caseData.services && Array.isArray(caseData.services)) {
      for (const s of caseData.services) {
        let srv = await this.caseServiceRepo.findOne({
          where: { externalId: s.id },
        });
        if (!srv) {
          srv = new GreenwayCaseService();
          srv.externalId = s.id;
        }
        srv.caseExternalId = caseId;
        srv.serviceCode = s.serviceCode;
        srv.serviceName = s.serviceName;
        srv.quantity = s.quantity;
        srv.price = s.price;
        srv.totalAmount = s.totalAmount;
        srv.rawData = s;
        await this.caseServiceRepo.save(srv);
      }
    }

    // Sync Payments
    if (caseData.payments && Array.isArray(caseData.payments)) {
      for (const p of caseData.payments) {
        let pay = await this.casePaymentRepo.findOne({
          where: { externalId: p.id },
        });
        if (!pay) {
          pay = new GreenwayCasePayment();
          pay.externalId = p.id;
        }
        pay.caseExternalId = caseId;
        pay.paymentMethod = p.paymentMethod;
        pay.amount = p.amount;
        pay.paymentDate = p.paymentDate ? new Date(p.paymentDate) : null;
        pay.rawData = p;
        await this.casePaymentRepo.save(pay);
      }
    }

    this.logger.log(`Finished syncing case detail for case ${caseId}.`);
    return caseData;
  }
}
