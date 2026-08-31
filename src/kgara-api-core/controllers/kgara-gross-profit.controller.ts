import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraGrossProfitController {
  constructor(
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
  ) {}

  @Get('gross-profit/:id/linked-invoices')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getGrossProfitLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.find({
      where: { grossProfitId: id },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('gross-profit/:id/linked-invoices')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async addGrossProfitLinkedInvoice(
    @Param('id') id: string,
    @Body() body: { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string },
  ) {
    const link = this.linkedInvoiceRepo.create({
      grossProfitId: id,
      invoiceId: body.invoiceId,
      linkType: body.linkType,
      note: body.note,
    });
    return this.linkedInvoiceRepo.save(link);
  }

  @Delete('gross-profit/:id/linked-invoices/:linkedId')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.DELETE,
  })
  async removeGrossProfitLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    await this.linkedInvoiceRepo.delete({ id: linkedId, grossProfitId: id });
    return { success: true };
  }
}
