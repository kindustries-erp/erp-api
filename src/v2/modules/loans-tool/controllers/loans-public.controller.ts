import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoansService } from '../loans.service';
import { SimulateLoanDto } from '../dto/simulate-loan.dto';
import type { LoanSimulationResult } from '@/v2/core/loans-core';

@ApiTags('loans_public')
@Controller('api/v2/public/loans-tool')
export class LoansPublicController {
  constructor(private readonly loansService: LoansService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mô phỏng bảng phân kỳ khoản vay công khai (không cần đăng nhập)',
  })
  simulate(@Body() dto: SimulateLoanDto): LoanSimulationResult {
    return this.loansService.simulate(dto);
  }
}
