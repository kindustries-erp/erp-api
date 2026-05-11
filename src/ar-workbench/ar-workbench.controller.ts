import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserToken } from '../common/decorators/user-token.decorator';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { ArWorkbenchService } from './ar-workbench.service';
import { ArWorkbenchQueryDto } from './dto/ar-workbench-query.dto';
import { CreateArDocumentDto } from './dto/create-ar-document.dto';
import { UpdateArDocumentDto } from './dto/update-ar-document.dto';
import { CreateArApplicationDto } from './dto/create-ar-application.dto';
import { CreateArCollectionActivityDto } from './dto/create-ar-collection-activity.dto';
import { CreateArSalesInvoiceDto } from './dto/create-ar-sales-invoice.dto';
import { ReverseArDocumentDto } from './dto/reverse-ar-document.dto';

@ApiTags('AR Workbench')
@ApiBearerAuth()
@Controller('ar-workbench')
@UseGuards(DirectusAuthGuard)
export class ArWorkbenchController {
  constructor(private readonly service: ArWorkbenchService) {}

  @ApiOperation({ summary: 'AR production use-case coverage matrix' })
  @Get('coverage')
  getCoverage() {
    return this.service.getCoverage();
  }

  @ApiOperation({ summary: 'AR workbench summary' })
  @Get('summary')
  getSummary(@Query() query: ArWorkbenchQueryDto, @UserToken() token: string) {
    return this.service.getSummary(query, token);
  }

  @Get('documents')
  findDocuments(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findDocuments(query, token);
  }

  @Post('documents')
  createDocument(@Body() dto: CreateArDocumentDto, @UserToken() token: string) {
    return this.service.createDocument(dto, token);
  }

  @ApiOperation({ summary: 'Create draft AR sales invoice with lines' })
  @Post('sales-invoices')
  createSalesInvoice(
    @Body() dto: CreateArSalesInvoiceDto,
    @UserToken() token: string,
  ) {
    return this.service.createSalesInvoice(dto, token);
  }

  @ApiOperation({ summary: 'Post AR invoice and generate journal entry' })
  @Post('documents/:id/post')
  postDocument(@Param('id') id: string, @UserToken() token: string) {
    return this.service.postDocument(id, token);
  }

  @ApiOperation({
    summary: 'Reverse posted AR invoice with immutable reversal journal entry',
  })
  @Post('documents/:id/reverse')
  reverseDocument(
    @Param('id') id: string,
    @Body() dto: ReverseArDocumentDto,
    @UserToken() token: string,
  ) {
    return this.service.reverseDocument(id, dto, token);
  }

  @Patch('documents/:id')
  updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateArDocumentDto,
    @UserToken() token: string,
  ) {
    return this.service.updateDocument(id, dto, token);
  }

  @Get('applications')
  findApplications(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findApplications(query, token);
  }

  @Post('applications')
  createApplication(
    @Body() dto: CreateArApplicationDto,
    @UserToken() token: string,
  ) {
    return this.service.createApplication(dto, token);
  }

  @Get('collection-activities')
  findCollectionActivities(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findCollectionActivities(query, token);
  }

  @Post('collection-activities')
  createCollectionActivity(
    @Body() dto: CreateArCollectionActivityDto,
    @UserToken() token: string,
  ) {
    return this.service.createCollectionActivity(dto, token);
  }
}
