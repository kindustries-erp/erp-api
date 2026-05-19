---
inclusion: fileMatch
fileMatchPattern: "src/**/*.ts"
---

# NestJS Module & Service Patterns

## Creating a New Domain Module

Standard structure:
```
src/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts
├── <domain>.service.ts
└── dto/
    ├── create-<domain>.dto.ts
    ├── update-<domain>.dto.ts
    └── <domain>-query.dto.ts
```

Register the module in `src/app.module.ts`.

## Controller Pattern

```typescript
@ApiTags('MyDomain')
@ApiBearerAuth()
@Controller('my-domain')
@UseGuards(DirectusAuthGuard)
export class MyDomainController {
  constructor(private readonly service: MyDomainService) {}

  @Post()
  create(@Body() dto: CreateMyDomainDto, @UserToken() token: string) {
    return this.service.create(dto, token);
  }

  @Get()
  findAll(@Query() query: MyDomainQueryDto, @UserToken() token: string) {
    return this.service.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.service.findOne(id, token);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMyDomainDto, @UserToken() token: string) {
    return this.service.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.service.remove(id, token);
  }
}
```

## Service Pattern (Directus SDK)

```typescript
@Injectable()
export class MyDomainService {
  constructor(private readonly config: ConfigService) {}

  private getUserClient(token: string) {
    const url = this.config.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(token)).with(rest());
  }

  async findAll(query: MyDomainQueryDto, token: string) {
    const client = this.getUserClient(token);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    try {
      const [items, countResult] = await Promise.all([
        client.request(readItems('gw_my_collection', {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          sort: [query.sort ?? '-created_at'],
          filter: this.buildFilter(query),
        })),
        client.request(readItems('gw_my_collection', {
          aggregate: { count: ['id'] },
          filter: this.buildFilter(query),
        })),
      ]);

      const total = Number(countResult?.[0]?.count?.id ?? 0);
      return { items, meta: { total, page, pageSize } };
    } catch (error) {
      throwDirectusSdkError(error, 'Failed to fetch items');
    }
  }
}
```

## DTO Pattern

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class MyDomainQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by related entity' })
  @IsOptional()
  @IsUUID()
  related_id?: string;
}
```

## Error Handling Pattern

```typescript
import { throwDirectusSdkError, rethrowHttpException } from '../common/utils/directus-error.util';

try {
  // Directus SDK call
} catch (error) {
  rethrowHttpException(error); // Re-throw if already an HttpException
  throwDirectusSdkError(error, 'Descriptive fallback message');
}
```

## Soft Delete Pattern

Many collections use `status` field instead of hard delete:
```typescript
// "Delete" = set status to CANCELLED or is_active to false
await client.request(updateItem('gw_collection', id, { status: 'CANCELLED' }));
```

## Voucher Status Workflow

```
DRAFT → PENDING_APPROVAL → CONFIRMED → (POSTED)
                         → REJECTED
DRAFT/PENDING/CONFIRMED → CANCELLED
```

Each transition has its own endpoint: `/submit`, `/approve`, `/reject`, `/cancel`, `/post-to-journal`.
