import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { TypeORMError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof TypeORMError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = {
        statusCode: status,
        message: exception.message,
        type: exception.name,
      };
      this.logger.error(`TypeORM Error: ${exception.message}`, exception.stack);
    } else if (exception instanceof Error) {
      // General error (like TypeError, ReferenceError) which includes TypeORM parsing crashes
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = {
        statusCode: status,
        message: exception.message,
        type: exception.name,
        stack:
          process.env.NODE_ENV !== 'production' ? exception.stack : undefined,
      };
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`Unknown Exception: ${JSON.stringify(exception)}`);
    }

    const errorResponse =
      typeof message === 'object' && message !== null
        ? message
        : { statusCode: status, message };

    response.status(status).json(errorResponse);
  }
}
