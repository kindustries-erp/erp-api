import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateViettelV2DraftDto, SyncViettelV2InboundDto } from './dto/viettel-v2.dto';
import { ViettelV2Service } from './viettel-v2.service';

@Controller('viettel-v2')
export class ViettelV2Controller {
  constructor(private readonly viettelV2Service: ViettelV2Service) {}

  @Get('health')
  async health() {
    return this.viettelV2Service.health();
  }

  @Post('draft')
  async createDraft(@Body() body: CreateViettelV2DraftDto) {
    return this.viettelV2Service.createDraft(body);
  }

  @Post('sync/inbound')
  async syncInbound(@Body() body: SyncViettelV2InboundDto) {
    return this.viettelV2Service.syncInbound(body);
  }

  @Get('local')
  async listLocal(@Query() query: any) {
    return this.viettelV2Service.listLocal(query);
  }

  @Get('templates')
  async getTemplates() {
    return this.viettelV2Service.getTemplates();
  }
}
