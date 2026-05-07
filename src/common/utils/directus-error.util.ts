import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

function parseDirectusMessage(body: string): string | null {
  if (!body) return null;

  try {
    const parsed = JSON.parse(body);
    const message = parsed?.errors?.[0]?.message || parsed?.message;
    return typeof message === 'string' ? message : null;
  } catch {
    return body;
  }
}

export async function throwDirectusResponseError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  const body = await response.text().catch(() => '');
  const message =
    parseDirectusMessage(body) || response.statusText || fallbackMessage;

  switch (response.status) {
    case 400:
      throw new BadRequestException(message);
    case 401:
      throw new UnauthorizedException(message);
    case 403:
      throw new ForbiddenException(message);
    case 404:
      throw new NotFoundException(message);
    case 409:
      throw new ConflictException(message);
    default:
      throw new InternalServerErrorException(message);
  }
}

export function rethrowHttpException(error: unknown): void {
  if (error instanceof HttpException) {
    throw error;
  }
}

export function throwDirectusSdkError(
  error: any,
  fallbackMessage: string,
): never {
  rethrowHttpException(error);

  const directusError = error?.errors?.[0];
  const message = directusError?.message || error?.message || fallbackMessage;
  const status =
    error?.status ||
    error?.response?.status ||
    directusError?.extensions?.status ||
    directusError?.extensions?.statusCode;
  const code = directusError?.extensions?.code;

  switch (status || code) {
    case 400:
    case 'INVALID_PAYLOAD':
    case 'FAILED_VALIDATION':
    case 'RECORD_NOT_UNIQUE':
      throw new BadRequestException(message);
    case 401:
    case 'INVALID_CREDENTIALS':
    case 'TOKEN_EXPIRED':
      throw new UnauthorizedException(message);
    case 403:
    case 'FORBIDDEN':
      throw new ForbiddenException(message);
    case 404:
    case 'NOT_FOUND':
      throw new NotFoundException(message);
    case 409:
      throw new ConflictException(message);
    default:
      throw new InternalServerErrorException(message);
  }
}
