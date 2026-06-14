import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { UserToken } from '../common/decorators/user-token.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('ping')
  ping() {
    return 'pong';
  }

  @Post('upload')
  @UseGuards(DirectusAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @UserToken() token: string) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file để upload');
    }
    return this.filesService.upload(file, token);
  }

  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Res() res: any,
    @UserToken() token?: string,
  ) {
    const { stream, contentType, contentLength } =
      await this.filesService.getFileStream(id, token);

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Convert Web ReadableStream to Node Readable if necessary
    if (stream && (stream as any).getReader) {
      Readable.fromWeb(stream as any).pipe(res);
    } else {
      (stream as any).pipe(res);
    }
  }
}
