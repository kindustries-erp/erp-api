import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiHubCoreService } from './ai-hub-core.service';
import { AiModuleInvokeDto } from './dto/ai-module-invoke.dto';
import { AiChatCompletionDto } from './dto/ai-chat-completion.dto';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';

@ApiTags('ai-hub-core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-hub')
export class AiHubCoreController {
  constructor(private readonly aiHubCoreService: AiHubCoreService) {}

  @Post('invoke')
  @ApiOperation({ summary: 'Kích hoạt xử lý AI cho phân hệ nghiệp vụ cụ thể' })
  async invoke(@Body() dto: AiModuleInvokeDto, @Req() req: any) {
    const actor = {
      userId: req?.user?.sub || req?.user?.id,
      email: req?.user?.email,
    };
    return this.aiHubCoreService.invokeModule(dto, actor);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat completion trực tiếp qua 9router' })
  async chat(@Body() dto: AiChatCompletionDto, @Req() req: any) {
    const actor = {
      userId: req?.user?.sub || req?.user?.id,
      email: req?.user?.email,
    };
    return this.aiHubCoreService.chatCompletion(dto, actor);
  }

  @Get('configs')
  @ApiOperation({ summary: 'Lấy danh sách cấu hình AI các phân hệ' })
  async getConfigs() {
    return this.aiHubCoreService.getConfigs();
  }

  @Get('configs/:moduleCode')
  @ApiOperation({ summary: 'Lấy chi tiết cấu hình AI của một phân hệ' })
  async getConfig(@Param('moduleCode') moduleCode: string) {
    return this.aiHubCoreService.getConfig(moduleCode);
  }

  @Patch('configs/:moduleCode')
  @ApiOperation({ summary: 'Cập nhật cấu hình AI của một phân hệ' })
  async updateConfig(
    @Param('moduleCode') moduleCode: string,
    @Body() dto: UpdateAiConfigDto,
  ) {
    return this.aiHubCoreService.updateConfig(moduleCode, dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Tra cứu lịch sử gọi AI và token usage' })
  async getLogs(@Query('limit') limit?: string) {
    return this.aiHubCoreService.getLogs(limit ? parseInt(limit, 10) : 50);
  }

  @Get('health-check')
  @ApiOperation({ summary: 'Kiểm tra trạng thái kết nối tới 9router gateway' })
  async healthCheck() {
    return this.aiHubCoreService.healthCheck();
  }
}
