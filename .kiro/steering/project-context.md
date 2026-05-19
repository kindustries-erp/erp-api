---
inclusion: auto
---

# Liouni ERP API — Project Context & Coding Standards

## System Overview

Liouni ERP is a Vietnamese enterprise resource planning system with three tiers:
1. **Directus Staging** (PostgreSQL + Directus CMS) — schema & data
2. **ERP API** (this repo, NestJS) — business logic, auth proxy, Directus SDK
3. **ERP Web** (React SPA) — frontend

All Directus collections use `gw_` prefix (e.g. `gw_payment_vouchers`, `gw_employees`).

## Tech Stack

- NestJS 11 + TypeScript
- @directus/sdk (REST client with staticToken for admin, user tokens for scoped access)
- Passport + passport-jwt + @nestjs/jwt (auth)
- class-validator + class-transformer (DTO validation)
- @nestjs/swagger (API documentation at `/api/docs`)
- Jest + supertest (testing)
- PostgreSQL (via Directus — no direct ORM)

## Architecture: Domain-Driven Modules

```
src/
├── main.ts              # Bootstrap: /api/v1 prefix, CORS, ValidationPipe, Swagger
├── app.module.ts        # Root module importing all domain modules
├── common/
│   ├── decorators/      # @UserToken() — extracts Bearer token
│   ├── dto/             # PaginationDto (page, pageSize, sort, search)
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Response interceptors
│   └── utils/           # directus-error.util.ts
├── directus/
│   ├── directus.module.ts
│   └── directus.provider.ts  # Global DIRECTUS_CLIENT (admin staticToken)
├── auth/                # Login/Register/Refresh/Logout/Impersonate/Profile
└── <domain>/            # ~20 domain modules
    ├── <domain>.module.ts
    ├── <domain>.controller.ts
    ├── <domain>.service.ts
    └── dto/
```

## Critical Rules

### 1. DB-First Policy (Gate 0)
Before any API change, verify Directus schema:
- Collections/fields exist
- Constraints/indexes/defaults are correct
- Result: `DB_READY` or `DB_GAP_FOUND`
- If gap found → fix DB first, then API

### 2. Module Boundaries
- Each domain is self-contained (controller + service + DTOs)
- No cross-domain controller mixing
- Import services from other modules only when necessary

### 3. DTO & Validation
- ALL request input must go through DTOs with class-validator decorators
- Use `@Type(() => Number)` for query params (they arrive as strings)
- Use `@ApiPropertyOptional()` for Swagger documentation
- ValidationPipe is global: `whitelist: true, forbidNonWhitelisted: true, transform: true`

### 4. Reuse First
Before creating new utilities, check:
- `src/common/**` (shared decorators, DTOs, utils)
- `src/directus/**` (SDK helpers)
- Existing domain modules for similar patterns

### 5. Error Handling
- Use `throwDirectusSdkError()` or `throwDirectusResponseError()` from `src/common/utils/directus-error.util.ts`
- These map Directus error codes to proper NestJS HTTP exceptions
- Always `rethrowHttpException(error)` first to preserve already-mapped errors

## Authentication Pattern

```typescript
@UseGuards(DirectusAuthGuard)
@ApiBearerAuth()
@Controller('my-domain')
export class MyController {
  @Get()
  findAll(@Query() query: MyQueryDto, @UserToken() token: string) {
    return this.service.findAll(query, token);
  }
}
```

- `DirectusAuthGuard` validates the Directus JWT
- `@UserToken()` extracts the Bearer token for scoped Directus SDK calls
- Services receive the user token and use it for Directus requests (respects user permissions)

## Directus SDK Usage

```typescript
// Admin operations (user management, schema reads)
@Inject(DIRECTUS_CLIENT) private readonly directus;
await this.directus.request(readItems('collection', { ... }));

// User-scoped operations (respects permissions)
const userClient = createDirectus(url).with(staticToken(userToken)).with(rest());
await userClient.request(readItems('gw_payment_vouchers', { filter, sort, limit, offset }));
```

## Standard Pagination Pattern

### DTO
```typescript
export class MyQueryDto extends PaginationDto {
  @IsOptional() @IsString()
  status?: string;
}
```

### Response Shape
```typescript
{
  items: T[],
  meta: { total: number, page: number, pageSize: number }
}
```

## API Prefix

All routes are under `/api/v1/` (set in `main.ts`).

## Validation & Build

```bash
npm run build           # nest build
npm run check           # tsc --noEmit + eslint + prettier --check
npm run test            # jest
npm run test:e2e        # jest e2e
```

## Environment Variables

Key env vars (see `.env.example`):
- `DIRECTUS_URL` — Directus instance URL
- `DIRECTUS_ADMIN_TOKEN` — Admin static token for privileged operations
- `JWT_IMPERSONATION_SECRET` — Secret for impersonation tokens
- `PORT` — Server port (default 3000)

## Swagger

Available at `/api/docs` in development. Use `@ApiTags()`, `@ApiOperation()`, `@ApiBearerAuth()` decorators.
