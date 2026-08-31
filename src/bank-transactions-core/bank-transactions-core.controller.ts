import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Request,
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../auth/decorators/require-permissions.decorator';
import { BankTransactionsCoreService } from './bank-transactions-core.service';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/create-bank-account.dto';
import {
  CreateCashBookDto,
  UpdateCashBookDto,
} from './dto/create-cash-book.dto';
import { BankTransactionFilterDto } from './dto/bank-transaction-filter.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { UpdateBankTransactionDto } from './dto/update-bank-transaction.dto';
import {
  CreateBankAccountBalanceDto,
  UpdateBankAccountBalanceDto,
} from './dto/create-bank-account-balance.dto';
import {
  CreateCashBookBalanceDto,
  UpdateCashBookBalanceDto,
} from './dto/create-cash-book-balance.dto';
import { PostBankTransactionDto } from './dto/post-bank-transaction.dto';

@ApiTags('bank-transactions-core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('bank-transactions-core')
export class BankTransactionsCoreController {
  constructor(
    private readonly service: BankTransactionsCoreService,
    private readonly traceabilityService: DocumentTraceabilityService,
  ) {}

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('transactions/:id/traceability-graph')
  getTraceabilityGraph(@Param('id') id: string, @Request() req: any) {
    return this.traceabilityService.getBankTransactionTraceabilityGraph(
      id,
      req.user,
    );
  }

  // --- Bank Accounts ---
  @RequirePermissions({ resource: 'bank_statements', action: 'read' })
  @Get('bank-accounts')
  getBankAccounts(
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getBankAccounts(branchId, startDate, endDate);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'create' })
  @Post('bank-accounts')
  createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.service.createBankAccount(dto);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'update' })
  @Patch('bank-accounts/:id')
  updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.service.updateBankAccount(id, dto);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'delete' })
  @Delete('bank-accounts/:id')
  deleteBankAccount(@Param('id') id: string) {
    return this.service.deleteBankAccount(id);
  }

  // --- Cash Books ---
  @RequirePermissions({ resource: 'cash_statements', action: 'read' })
  @Get('cash-books')
  getCashBooks(
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getCashBooks(branchId, startDate, endDate);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'create' })
  @Post('cash-books')
  createCashBook(@Body() dto: CreateCashBookDto) {
    return this.service.createCashBook(dto);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'update' })
  @Patch('cash-books/:id')
  updateCashBook(@Param('id') id: string, @Body() dto: UpdateCashBookDto) {
    return this.service.updateCashBook(id, dto);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'delete' })
  @Delete('cash-books/:id')
  deleteCashBook(@Param('id') id: string) {
    return this.service.deleteCashBook(id);
  }

  // --- Transactions ---
  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('transactions/column-options')
  getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
    @Query('sourceType') sourceType?: 'BANK' | 'CASH',
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
      sourceType,
    );
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.service.getTransaction(id);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('transactions/:id/posting')
  getTransactionPosting(@Param('id') id: string) {
    return this.service.getTransactionPosting(id);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('transactions')
  getTransactions(@Query() filter: BankTransactionFilterDto) {
    return this.service.getTransactions(filter);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('dashboard-stats')
  getDashboardStats(@Query() filter: BankTransactionFilterDto) {
    return this.service.getDashboardStats(filter);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('partner-stats')
  getPartnerStats(@Query() filter: BankTransactionFilterDto) {
    return this.service.getPartnerStats(filter);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'create' },
    { resource: 'cash_statements', action: 'create' },
  )
  @Post('transactions/manual')
  createManualTransaction(@Body() dto: CreateBankTransactionDto) {
    return this.service.createManualTransaction(dto);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'update' },
    { resource: 'cash_statements', action: 'update' },
  )
  @Patch('transactions/:id')
  updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateBankTransactionDto,
  ) {
    return this.service.updateTransaction(id, dto);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'update' },
    { resource: 'cash_statements', action: 'update' },
  )
  @Post('transactions/:id/post')
  postTransaction(
    @Param('id') id: string,
    @Body() dto: PostBankTransactionDto,
  ) {
    return this.service.postTransaction(id, dto);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'update' },
    { resource: 'cash_statements', action: 'update' },
  )
  @Post('transactions/:id/unpost')
  unpostTransaction(@Param('id') id: string) {
    return this.service.unpostTransaction(id);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'update' },
    { resource: 'cash_statements', action: 'update' },
  )
  @Post('transactions/:id/net-off-invoices')
  linkInvoice(
    @Param('id') id: string,
    @Body() body: { invoiceId: string; netOffAmount?: number },
  ) {
    return this.service.linkInvoiceToTransaction(id, body);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'update' },
    { resource: 'cash_statements', action: 'update' },
  )
  @Delete('transactions/:id/net-off-invoices/:netOffId')
  removeInvoice(@Param('id') id: string, @Param('netOffId') netOffId: string) {
    return this.service.removeInvoiceFromTransaction(id, netOffId);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'create' },
    { resource: 'cash_statements', action: 'create' },
  )
  @Post('transactions/import')
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        branchId: { type: 'string' },
        bankAccountId: { type: 'string' },
        cashBookId: { type: 'string' },
      },
    },
  })
  importFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('branchId') branchId: string,
    @Body('bankAccountId') bankAccountId?: string,
    @Body('cashBookId') cashBookId?: string,
  ) {
    if (!files || files.length === 0)
      throw new BadRequestException('At least one file is required');
    if (files.length > 5)
      throw new BadRequestException('Cannot upload more than 5 files');
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.service.importFiles(files, branchId, bankAccountId, cashBookId);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'delete' },
    { resource: 'cash_statements', action: 'delete' },
  )
  @Delete('transactions/batch/:batchId')
  rollbackBatch(@Param('batchId') batchId: string) {
    return this.service.rollbackBatch(batchId);
  }

  // --- Balances ---
  @RequirePermissions({ resource: 'bank_statements', action: 'read' })
  @Get('bank-account-balances')
  getBankAccountBalances(@Query('bankAccountId') bankAccountId: string) {
    if (!bankAccountId)
      throw new BadRequestException('bankAccountId is required');
    return this.service.getBankAccountBalances(bankAccountId);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'create' })
  @Post('bank-account-balances')
  createBankAccountBalance(@Body() dto: CreateBankAccountBalanceDto) {
    return this.service.createBankAccountBalance(dto);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'update' })
  @Patch('bank-account-balances/:id')
  updateBankAccountBalance(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountBalanceDto,
  ) {
    return this.service.updateBankAccountBalance(id, dto);
  }

  @RequirePermissions({ resource: 'bank_statements', action: 'delete' })
  @Delete('bank-account-balances/:id')
  deleteBankAccountBalance(@Param('id') id: string) {
    return this.service.deleteBankAccountBalance(id);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'read' })
  @Get('cash-book-balances')
  getCashBookBalances(@Query('cashBookId') cashBookId: string) {
    if (!cashBookId) throw new BadRequestException('cashBookId is required');
    return this.service.getCashBookBalances(cashBookId);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'create' })
  @Post('cash-book-balances')
  createCashBookBalance(@Body() dto: CreateCashBookBalanceDto) {
    return this.service.createCashBookBalance(dto);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'update' })
  @Patch('cash-book-balances/:id')
  updateCashBookBalance(
    @Param('id') id: string,
    @Body() dto: UpdateCashBookBalanceDto,
  ) {
    return this.service.updateCashBookBalance(id, dto);
  }

  @RequirePermissions({ resource: 'cash_statements', action: 'delete' })
  @Delete('cash-book-balances/:id')
  deleteCashBookBalance(@Param('id') id: string) {
    return this.service.deleteCashBookBalance(id);
  }

  // --- Statement Files ---
  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('statement-files')
  getStatementFiles(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('branchId') branchId?: string,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('cashBookId') cashBookId?: string,
  ) {
    return this.service.getStatementFiles({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      branchId,
      bankAccountId,
      cashBookId,
    });
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'create' },
    { resource: 'cash_statements', action: 'create' },
  )
  @Post('statement-files')
  createStatementFile(
    @Body()
    dto: import('./dto/create-bank-statement-file.dto').CreateBankStatementFileDto,
  ) {
    return this.service.createStatementFile(dto);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'delete' },
    { resource: 'cash_statements', action: 'delete' },
  )
  @Delete('statement-files/:id')
  deleteStatementFile(@Param('id') id: string) {
    return this.service.deleteStatementFile(id);
  }

  // --- Background Excel Export ---
  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Post('export/excel/background')
  startExportExcelBackground(
    @Body() query: BankTransactionFilterDto,
    @Request() req: any,
  ) {
    return this.service.startExportExcelBackground(query, req.user?.sub);
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('export/excel/background/history')
  getExportExcelBackgroundHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getExportExcelHistory(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @RequireAnyPermissions(
    { resource: 'bank_statements', action: 'read' },
    { resource: 'cash_statements', action: 'read' },
  )
  @Get('export/excel/background/:jobId/download')
  async downloadBackgroundExport(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = this.service.getExportExcelBackgroundFile(
      jobId,
      req.user?.sub,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Sse('export/excel/progress/stream')
  exportExcelProgressStream(@Request() req: any): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        data: JSON.stringify({
          processId: 'ping',
          current: 0,
          total: 100,
          isRunning: false,
          completed: false,
          ready: false,
          failed: false,
          message: 'Connected',
        }),
      } as MessageEvent);

      const snapshot = this.service.getExportExcelProgressSnapshot(
        req.user?.sub,
      );
      if (snapshot) {
        subscriber.next({
          data: JSON.stringify(snapshot),
        } as MessageEvent);
      }

      const sub = this.service.getExportExcelProgressStream().subscribe({
        next: (event) => {
          if (!event.userId || event.userId === req.user?.sub) {
            subscriber.next({
              data: JSON.stringify(event),
            } as MessageEvent);
          }
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => sub.unsubscribe();
    });
  }
}
