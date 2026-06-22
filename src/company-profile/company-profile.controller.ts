import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('Company Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ công ty' })
  async getProfile() {
    const data = await this.companyProfileService.getProfile();
    return {
      message: 'Lấy thông tin hồ sơ công ty thành công',
      data,
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ công ty' })
  async updateProfile(@Body() dto: UpdateCompanyProfileDto) {
    const data = await this.companyProfileService.updateProfile(dto);
    return {
      message: 'Cập nhật thông tin hồ sơ công ty thành công',
      data,
    };
  }
}
