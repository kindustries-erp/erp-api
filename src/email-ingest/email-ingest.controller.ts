import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { ListEmailIngestDto } from './dto/list-email-ingest.dto';
import { SyncEmailIngestDto } from './dto/sync-email-ingest.dto';
import { EmailIngestService } from './email-ingest.service';

@ApiTags('email-ingest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('email-ingest')
export class EmailIngestController {
  constructor(private readonly service: EmailIngestService) {}

  @RequirePermissions({ resource: 'email_ingest', action: 'read' })
  @Get('emails')
  @ApiOperation({ summary: 'List persisted emails' })
  list(@Query() query: ListEmailIngestDto) {
    return this.service.listEmails(query);
  }

  @RequirePermissions({ resource: 'email_ingest', action: 'read' })
  @Get('emails/:id')
  @ApiOperation({ summary: 'Get persisted email detail' })
  detail(@Param('id') id: string) {
    return this.service.getEmail(id);
  }

  @RequirePermissions({ resource: 'email_ingest', action: 'create' })
  @Post('sync')
  @ApiOperation({
    summary:
      'Sync mail from IMAP mailbox and persist messages/attachments to ERP DB',
  })
  sync(@Body() dto: SyncEmailIngestDto) {
    return this.service.syncMailbox(dto);
  }
}
