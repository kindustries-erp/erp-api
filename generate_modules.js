const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Module definitions
// ─────────────────────────────────────────────────────────────────────────────
const modules = [
  {
    dir: 'business-partners',
    collection: 'gw_business_partners',
    className: 'BusinessPartners',
    label: 'đối tác kinh doanh',
    sortField: '-created_at',
    createDtoFields: `
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() display_name?: string;
  @IsString() @IsNotEmpty() partner_kind: string;
  @IsOptional() @IsString() tax_code?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() ward?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'business-partner-contacts',
    collection: 'gw_business_partner_contacts',
    className: 'BusinessPartnerContacts',
    label: 'liên hệ đối tác',
    sortField: '-created_at',
    createDtoFields: `
  @IsUUID() @IsNotEmpty() business_partner_id: string;
  @IsString() @IsNotEmpty() full_name: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() identity_no?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() is_default_receiver?: boolean;
  @IsOptional() @IsBoolean() is_default_payer?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'business-partner-bank-accounts',
    collection: 'gw_business_partner_bank_accounts',
    className: 'BusinessPartnerBankAccounts',
    label: 'tài khoản ngân hàng đối tác',
    sortField: '-created_at',
    createDtoFields: `
  @IsUUID() @IsNotEmpty() business_partner_id: string;
  @IsString() @IsNotEmpty() bank_name: string;
  @IsOptional() @IsString() bank_branch?: string;
  @IsString() @IsNotEmpty() account_number: string;
  @IsString() @IsNotEmpty() account_holder: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'cash-funds',
    collection: 'gw_cash_funds',
    className: 'CashFunds',
    label: 'quỹ tiền mặt',
    sortField: '-created_at',
    createDtoFields: `
  @IsString() @IsNotEmpty() fund_code: string;
  @IsString() @IsNotEmpty() fund_name: string;
  @IsOptional() @IsString() currency?: string;
  @IsUUID() @IsNotEmpty() accounting_account_id: string;
  @IsOptional() @IsUUID() responsible_user_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'opening-balances',
    collection: 'gw_opening_balances',
    className: 'OpeningBalances',
    label: 'số dư đầu kỳ',
    sortField: '-created_at',
    createDtoFields: `
  @IsString() @IsNotEmpty() fiscal_period: string;
  @IsString() @IsNotEmpty() balance_date: string;
  @IsUUID() @IsNotEmpty() account_id: string;
  @IsOptional() @IsUUID() cash_fund_id?: string;
  @IsOptional() @IsUUID() company_bank_account_id?: string;
  @IsOptional() @IsNumber() debit_amount?: number;
  @IsOptional() @IsNumber() credit_amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'payment-vouchers',
    collection: 'gw_payment_vouchers',
    className: 'PaymentVouchers',
    label: 'phiếu thu chi',
    sortField: '-created_at',
    createDtoFields: `
  @IsString() @IsNotEmpty() voucher_no: string;
  @IsString() @IsNotEmpty() voucher_channel: string;
  @IsString() @IsNotEmpty() voucher_direction: string;
  @IsString() @IsNotEmpty() voucher_type: string;
  @IsString() @IsNotEmpty() document_date: string;
  @IsString() @IsNotEmpty() posting_date: string;
  @IsUUID() @IsNotEmpty() counterparty_id: string;
  @IsOptional() @IsString() counterparty_role?: string;
  @IsOptional() @IsString() actual_person_name?: string;
  @IsOptional() @IsString() actual_person_id_no?: string;
  @IsOptional() @IsString() actual_person_phone?: string;
  @IsString() @IsNotEmpty() description: string;
  @IsUUID() @IsNotEmpty() debit_account_id: string;
  @IsUUID() @IsNotEmpty() credit_account_id: string;
  @IsOptional() @IsUUID() cash_fund_id?: string;
  @IsOptional() @IsUUID() company_bank_account_id?: string;
  @IsOptional() @IsUUID() beneficiary_bank_account_id?: string;
  @IsNumber() @IsNotEmpty() amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() amount_in_words?: string;
  @IsOptional() @IsString() status?: string;
  @IsString() @IsNotEmpty() counterparty_name_snapshot: string;
  @IsOptional() @IsString() counterparty_tax_code_snapshot?: string;
  @IsOptional() @IsString() counterparty_address_snapshot?: string;`,
  },
  {
    dir: 'payment-voucher-attachments',
    collection: 'gw_payment_voucher_attachments',
    className: 'PaymentVoucherAttachments',
    label: 'đính kèm phiếu thu chi',
    sortField: '-uploaded_at',
    createDtoFields: `
  @IsUUID() @IsNotEmpty() payment_voucher_id: string;
  @IsUUID() @IsNotEmpty() file: string;
  @IsOptional() @IsString() attachment_type?: string;
  @IsOptional() @IsString() note?: string;`,
  },
  {
    dir: 'payment-voucher-approval-logs',
    collection: 'gw_payment_voucher_approval_logs',
    className: 'PaymentVoucherApprovalLogs',
    label: 'nhật ký duyệt phiếu',
    sortField: '-action_at',
    createDtoFields: `
  @IsUUID() @IsNotEmpty() payment_voucher_id: string;
  @IsString() @IsNotEmpty() action: string;
  @IsOptional() @IsUUID() action_by?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() from_status?: string;
  @IsOptional() @IsString() to_status?: string;`,
  },
  {
    dir: 'voucher-numbering-configs',
    collection: 'gw_voucher_numbering_configs',
    className: 'VoucherNumberingConfigs',
    label: 'cấu hình đánh số phiếu',
    sortField: 'voucher_type',
    createDtoFields: `
  @IsString() @IsNotEmpty() voucher_type: string;
  @IsString() @IsNotEmpty() prefix: string;
  @IsOptional() @IsString() date_pattern?: string;
  @IsOptional() @IsNumber() current_sequence?: number;
  @IsOptional() @IsNumber() padding_length?: number;
  @IsString() @IsNotEmpty() reset_period: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Template generators
// ─────────────────────────────────────────────────────────────────────────────
function toPascal(str) {
  return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function genCreateDto(mod) {
  return `import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsNotEmpty } from 'class-validator';

export class Create${mod.className}Dto {${mod.createDtoFields}
}
`;
}

function genUpdateDto(mod) {
  return `import { PartialType } from '@nestjs/swagger';
import { Create${mod.className}Dto } from './create-${mod.dir}.dto';

export class Update${mod.className}Dto extends PartialType(Create${mod.className}Dto) {}
`;
}

function genService(mod) {
  const svc = `${mod.className}Service`;
  const label = mod.label;
  return `import * as crypto from 'crypto';
import { Injectable, Inject, UnauthorizedException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDirectus, readItem, createItem, updateItem, deleteItem, rest, staticToken } from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Create${mod.className}Dto } from './dto/create-${mod.dir}.dto';
import { Update${mod.className}Dto } from './dto/update-${mod.dir}.dto';

@Injectable()
export class ${svc} {
  private readonly logger = new Logger(${svc}.name);
  private readonly collection = '${mod.collection}';

  constructor(
    @Inject(DIRECTUS_CLIENT) private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private getClient(userToken: string) {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(userToken)).with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  async create(dto: Create${mod.className}Dto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { id: crypto.randomUUID(), ...dto })
      );
      return { message: 'Tạo ${label} thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo ${label}', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(\`Lỗi: \${msg}\`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '${mod.sortField}';
      const offset = (page - 1) * pageSize;
      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');

      const url = new URL(\`/items/\${this.collection}\`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const response = await fetch(url.toString(), {
        headers: { Authorization: \`Bearer \${userToken}\` }
      });
      if (!response.ok) throw new Error(\`Directus Error: \${response.statusText}\`);

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách ${label}', error);
      throw new InternalServerErrorException('Không thể lấy danh sách ${label}');
    }
  }

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request((readItem as any)(this.collection, id));
      return { message: 'Lấy thông tin ${label} thành công', data: result };
    } catch (error: any) {
      this.logger.error(\`Lỗi khi lấy thông tin ${label} \${id}\`, error);
      throw new InternalServerErrorException('Không thể lấy thông tin ${label}');
    }
  }

  async update(id: string, dto: Update${mod.className}Dto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request((updateItem as any)(this.collection, id, dto));
      return { message: 'Cập nhật ${label} thành công', data: result };
    } catch (error: any) {
      this.logger.error(\`Lỗi khi cập nhật ${label} \${id}\`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(\`Lỗi: \${msg}\`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((deleteItem as any)(this.collection, id));
      return { message: 'Xóa ${label} thành công' };
    } catch (error: any) {
      this.logger.error(\`Lỗi khi xóa ${label} \${id}\`, error);
      throw new InternalServerErrorException('Không thể xóa ${label}');
    }
  }
}
`;
}

function genController(mod) {
  const cls = mod.className;
  const svcVar = cls.charAt(0).toLowerCase() + cls.slice(1) + 'Service';
  return `import { UserToken } from '../common/decorators/user-token.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ${cls}Service } from './${mod.dir}.service';
import { Create${cls}Dto } from './dto/create-${mod.dir}.dto';
import { Update${cls}Dto } from './dto/update-${mod.dir}.dto';

@ApiTags('${cls}')
@ApiBearerAuth()
@Controller('${mod.dir}')
@UseGuards(DirectusAuthGuard)
export class ${cls}Controller {
  constructor(private readonly ${svcVar}: ${cls}Service) {}

  @Post()
  create(@Body() dto: Create${cls}Dto, @UserToken() token: string) {
    return this.${svcVar}.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @UserToken() token: string) {
    return this.${svcVar}.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.${svcVar}.findOne(id, token);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Update${cls}Dto, @UserToken() token: string) {
    return this.${svcVar}.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.${svcVar}.remove(id, token);
  }
}
`;
}

function genModule(mod) {
  const cls = mod.className;
  return `import { Module } from '@nestjs/common';
import { ${cls}Controller } from './${mod.dir}.controller';
import { ${cls}Service } from './${mod.dir}.service';

@Module({
  controllers: [${cls}Controller],
  providers: [${cls}Service],
})
export class ${cls}Module {}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate files
// ─────────────────────────────────────────────────────────────────────────────
const srcBase = path.join(__dirname, 'src');
const newImports = [];
const newModuleNames = [];

modules.forEach(mod => {
  const modDir = path.join(srcBase, mod.dir);
  const dtoDir = path.join(modDir, 'dto');
  fs.mkdirSync(dtoDir, { recursive: true });

  fs.writeFileSync(path.join(dtoDir, `create-${mod.dir}.dto.ts`), genCreateDto(mod));
  fs.writeFileSync(path.join(dtoDir, `update-${mod.dir}.dto.ts`), genUpdateDto(mod));
  fs.writeFileSync(path.join(modDir, `${mod.dir}.service.ts`), genService(mod));
  fs.writeFileSync(path.join(modDir, `${mod.dir}.controller.ts`), genController(mod));
  fs.writeFileSync(path.join(modDir, `${mod.dir}.module.ts`), genModule(mod));

  const cls = mod.className;
  newImports.push(`import { ${cls}Module } from './${mod.dir}/${mod.dir}.module';`);
  newModuleNames.push(cls + 'Module');
  console.log(`✓ Generated module: ${mod.dir}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Update app.module.ts
// ─────────────────────────────────────────────────────────────────────────────
const appModulePath = path.join(srcBase, 'app.module.ts');
let appModule = fs.readFileSync(appModulePath, 'utf-8');

// Add imports after last existing import line
const lastImportIndex = appModule.lastIndexOf("import {");
const lastImportEnd = appModule.indexOf('\n', lastImportIndex);
const insertAfter = appModule.indexOf('\n', lastImportEnd);

const importBlock = '\n' + newImports.join('\n');
appModule = appModule.slice(0, insertAfter) + importBlock + appModule.slice(insertAfter);

// Add modules in @Module imports array
const insertBefore = appModule.lastIndexOf('    ActivityLogsModule,');
const insertPoint = appModule.indexOf('\n', insertBefore) + 1;
const moduleBlock = newModuleNames.map(n => `    ${n},`).join('\n') + '\n';
appModule = appModule.slice(0, insertPoint) + moduleBlock + appModule.slice(insertPoint);

fs.writeFileSync(appModulePath, appModule);
console.log('\n✓ Updated app.module.ts');
console.log('\nDone! Run `npm run build` to verify.');
