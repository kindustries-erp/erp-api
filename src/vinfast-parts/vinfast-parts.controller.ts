import { Controller, Post } from '@nestjs/common';
import { VinfastPartsService } from './vinfast-parts.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('VinFast Parts')
@Controller('vinfast-parts')
export class VinfastPartsController {
  constructor(private readonly vinfastPartsService: VinfastPartsService) {}

  @Post('sync-catalog')
  @ApiOperation({ summary: 'Sync VinFast parts catalog from invoice history' })
  async syncCatalog() {
    return this.vinfastPartsService.syncCatalog();
  }

  @Post('sync-ledger')
  @ApiOperation({ summary: 'Sync VinFast parts ledger from invoice history' })
  async syncLedger() {
    return this.vinfastPartsService.syncLedger();
  }
}
