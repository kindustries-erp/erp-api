import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PublicWarrantyService } from './public-warranty.service';
import { CheckWarrantyDto } from './dto/check-warranty.dto';
import { ActivateWarrantyDto } from './dto/activate-warranty.dto';
// Note: Optional API Key guard could be added here later. For now we expose the endpoints.

@Controller('public-warranty')
export class PublicWarrantyController {
  constructor(private readonly warrantyService: PublicWarrantyService) {}

  @Post('check')
  async check(@Body() dto: CheckWarrantyDto) {
    return this.warrantyService.check(dto);
  }

  @Post('activate')
  async activate(@Body() dto: ActivateWarrantyDto) {
    return this.warrantyService.activate(dto);
  }
}
