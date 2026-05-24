import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';

// ─── Global fetch mock ───────────────────────────────────────────────
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ─── Mock @directus/sdk ──────────────────────────────────────────────
const mockRequest = jest.fn();
jest.mock('@directus/sdk', () => ({
  createDirectus: jest.fn(() => ({
    with: jest.fn().mockReturnThis(),
    request: mockRequest,
  })),
  rest: jest.fn(),
  staticToken: jest.fn(),
  readItem: jest.fn((collection: string, id: string) => ({
    type: 'readItem',
    collection,
    id,
  })),
  createItem: jest.fn((collection: string, data: any) => ({
    type: 'createItem',
    collection,
    data,
  })),
  updateItem: jest.fn((collection: string, id: string, data: any) => ({
    type: 'updateItem',
    collection,
    id,
    data,
  })),
}));

describe('BranchesService – Directus error forwarding', () => {
  let service: BranchesService;

  const mockConfigValues: Record<string, string> = {
    DIRECTUS_URL: 'http://localhost:8055',
    DIRECTUS_ADMIN_TOKEN: 'admin-token',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockRequest.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: DIRECTUS_CLIENT,
          useValue: { request: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (mockConfigValues[key]) return mockConfigValues[key];
              throw new Error(`Config key ${key} not found`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Helper: tạo Directus SDK error giống thật
  // ═══════════════════════════════════════════════════════════════════
  function makeDirectusSdkError(status: number, code: string, message: string) {
    const err: any = new Error(message);
    err.errors = [
      {
        message,
        extensions: { code, status },
      },
    ];
    err.status = status;
    return err;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE – Directus trả 403 → API phải trả 403, không phải 400
  // ═══════════════════════════════════════════════════════════════════
  describe('create()', () => {
    it('should forward Directus 403 Forbidden as ForbiddenException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          403,
          'FORBIDDEN',
          "You don't have permission to access this.",
        ),
      );

      await expect(
        service.create({ code: 'HN', name: 'Hà Nội' } as any, 'user-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forward Directus 403 with original message', async () => {
      const originalMessage = "You don't have permission to access this.";
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(403, 'FORBIDDEN', originalMessage),
      );

      await expect(
        service.create({ code: 'HN', name: 'Hà Nội' } as any, 'user-token'),
      ).rejects.toMatchObject({
        message: originalMessage,
      });
    });

    it('should forward Directus 400 INVALID_PAYLOAD as BadRequestException', async () => {
      const msg = 'Field "code" is required.';
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(400, 'INVALID_PAYLOAD', msg),
      );

      await expect(
        service.create({ name: 'Test' } as any, 'user-token'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({ name: 'Test' } as any, 'user-token'),
      ).rejects.toMatchObject({ message: msg });
    });

    it('should forward Directus 404 as NotFoundException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(404, 'NOT_FOUND', 'Collection not found.'),
      );

      await expect(
        service.create({ code: 'X', name: 'X' } as any, 'user-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIND ALL – dùng fetch, Directus trả 403 → API phải trả 403
  // ═══════════════════════════════════════════════════════════════════
  describe('findAll()', () => {
    it('should forward Directus 403 response as ForbiddenException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          JSON.stringify({
            errors: [{ message: "You don't have permission to access this." }],
          }),
      });

      await expect(
        service.findAll({ page: 1, pageSize: 20 }, 'user-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forward Directus 403 with original error message', async () => {
      const originalMessage = "You don't have permission to access this.";
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          JSON.stringify({ errors: [{ message: originalMessage }] }),
      });

      await expect(
        service.findAll({ page: 1, pageSize: 20 }, 'user-token'),
      ).rejects.toMatchObject({ message: originalMessage });
    });

    it('should forward Directus 401 as UnauthorizedException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () =>
          JSON.stringify({
            errors: [{ message: 'Invalid user credentials.' }],
          }),
      });

      await expect(
        service.findAll({ page: 1, pageSize: 20 }, 'user-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIND ONE – Directus trả 403 → API phải trả 403, không phải 500
  // ═══════════════════════════════════════════════════════════════════
  describe('findOne()', () => {
    it('should forward Directus 403 as ForbiddenException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          403,
          'FORBIDDEN',
          "You don't have permission to access this.",
        ),
      );

      await expect(service.findOne('branch-1', 'user-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should forward Directus 404 as NotFoundException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          404,
          'NOT_FOUND',
          "Item 'branch-1' doesn't exist.",
        ),
      );

      await expect(service.findOne('branch-1', 'user-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve original Directus error message', async () => {
      const msg = "Item 'branch-1' doesn't exist.";
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(404, 'NOT_FOUND', msg),
      );

      await expect(
        service.findOne('branch-1', 'user-token'),
      ).rejects.toMatchObject({ message: msg });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE – Directus trả 403 → API phải trả 403, không phải 400
  // ═══════════════════════════════════════════════════════════════════
  describe('update()', () => {
    it('should forward Directus 403 as ForbiddenException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          403,
          'FORBIDDEN',
          "You don't have permission to access this.",
        ),
      );

      await expect(
        service.update('branch-1', { name: 'Updated' } as any, 'user-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forward Directus 404 as NotFoundException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          404,
          'NOT_FOUND',
          "Item 'branch-1' doesn't exist.",
        ),
      );

      await expect(
        service.update('branch-1', { name: 'Updated' } as any, 'user-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should forward Directus 400 with original message', async () => {
      const msg = 'Field "code" has to be unique.';
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(400, 'RECORD_NOT_UNIQUE', msg),
      );

      await expect(
        service.update('branch-1', { code: 'DUP' } as any, 'user-token'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('branch-1', { code: 'DUP' } as any, 'user-token'),
      ).rejects.toMatchObject({ message: msg });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOVE – Directus trả 403 → API phải trả 403, không phải 500
  // ═══════════════════════════════════════════════════════════════════
  describe('remove()', () => {
    it('should forward Directus 403 as ForbiddenException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          403,
          'FORBIDDEN',
          "You don't have permission to access this.",
        ),
      );

      await expect(service.remove('branch-1', 'user-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should forward Directus 404 as NotFoundException', async () => {
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(
          404,
          'NOT_FOUND',
          "Item 'branch-1' doesn't exist.",
        ),
      );

      await expect(service.remove('branch-1', 'user-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve original Directus error message', async () => {
      const msg = "You don't have permission to access this.";
      mockRequest.mockRejectedValue(
        makeDirectusSdkError(403, 'FORBIDDEN', msg),
      );

      await expect(
        service.remove('branch-1', 'user-token'),
      ).rejects.toMatchObject({ message: msg });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GUARD – thiếu token → 401
  // ═══════════════════════════════════════════════════════════════════
  describe('missing token guard', () => {
    it('create() throws UnauthorizedException without token', async () => {
      await expect(
        service.create({ code: 'X', name: 'X' } as any, ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('findAll() throws UnauthorizedException without token', async () => {
      await expect(service.findAll({}, '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('findOne() throws UnauthorizedException without token', async () => {
      await expect(service.findOne('id', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('update() throws UnauthorizedException without token', async () => {
      await expect(
        service.update('id', { name: 'X' } as any, ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('remove() throws UnauthorizedException without token', async () => {
      await expect(service.remove('id', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
