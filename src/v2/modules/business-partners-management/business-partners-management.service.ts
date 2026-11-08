import { Injectable } from '@nestjs/common';
import {
  BusinessPartnersCoreService,
  CreateErpBusinessPartnerDto,
  QueryErpBusinessPartnerDto,
  QueryErpBusinessPartnerOptionsDto,
  UpdateErpBusinessPartnerDto,
} from '@/v2/core/business-partners-core';

/**
 * Facade Service của module Business Partners Management.
 * Điều phối các nghiệp vụ HTTP cho controller và delegate sang BusinessPartnersCoreService.
 */
@Injectable()
export class BusinessPartnersManagementService {
  constructor(private readonly core: BusinessPartnersCoreService) {}

  ensurePartnerForInvoiceKey(ref: {
    taxCode: string | null;
    name: string;
    partnerType: 'CUSTOMER' | 'VENDOR';
  }) {
    return this.core.ensurePartnerForInvoiceKey(ref);
  }

  listOptions(dto: QueryErpBusinessPartnerOptionsDto) {
    return this.core.listOptions(dto);
  }

  syncFromInvoices(dryRun = false) {
    return this.core.syncFromInvoices(dryRun);
  }

  findAll(dto: QueryErpBusinessPartnerDto) {
    return this.core.findAll(dto);
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
    partnerType?: string,
  ) {
    return this.core.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
      partnerType,
    );
  }

  getNextCode(partnerType?: string) {
    return this.core.getNextCode(partnerType);
  }

  findOne(id: string) {
    return this.core.findOne(id);
  }

  create(dto: CreateErpBusinessPartnerDto) {
    return this.core.create(dto);
  }

  update(id: string, dto: UpdateErpBusinessPartnerDto) {
    return this.core.update(id, dto);
  }

  remove(id: string) {
    return this.core.remove(id);
  }
}
