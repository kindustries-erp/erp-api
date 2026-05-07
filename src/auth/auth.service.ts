import {
  Injectable,
  Inject,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createDirectus,
  rest,
  authentication,
  createUser,
  readUsers,
  updateUser,
  updateItem,
  staticToken,
  readMe,
  readItems,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface DirectusAuthResult {
  access_token: string;
  refresh_token: string;
  expires: number;
}

interface PermissionDetail {
  action: string;
  fields: string[] | null;
  permissions: Record<string, any> | null;
  validation: Record<string, any> | null;
  source?: 'role' | 'custom';
}

interface CollectionPermission {
  collection: string;
  actions: string[];
  details: PermissionDetail[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // ─────────────────────────────────────────────
  // REGISTER
  // Tạo user mới trên Directus bằng admin token, sau đó tự login để trả token về frontend.
  // ─────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // 1. Kiểm tra email đã tồn tại chưa
    const existing = await (this.directus as any).request(
      readUsers({
        filter: { email: { _eq: dto.email } },
        limit: 1,
      }),
    );

    if (existing && existing.length > 0) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // 2. Tạo user mới trong Directus
    let newUser: any;
    try {
      newUser = await (this.directus as any).request(
        createUser({
          email: dto.email,
          password: dto.password,
          first_name: dto.first_name,
          last_name: dto.last_name,
          status: 'active',
        }),
      );
    } catch (err: any) {
      this.logger.error('Lỗi khi tạo user Directus', err);
      throw new InternalServerErrorException(
        'Không thể tạo tài khoản, thử lại sau',
      );
    }

    // 3. Tự động login để lấy Directus tokens trả về ngay cho frontend
    const tokens = await this._directusLogin(dto.email, dto.password);

    return {
      message: 'Đăng ký thành công',
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires: tokens.expires,
    };
  }

  // ─────────────────────────────────────────────
  // LOGIN
  // Nhận email/password từ frontend → gọi Directus POST /auth/login → trả token về frontend.
  // ─────────────────────────────────────────────
  async login(dto: LoginDto) {
    return this._directusLogin(dto.email, dto.password);
  }

  // ─────────────────────────────────────────────
  // REFRESH TOKEN
  // Frontend gửi refresh_token → Directus cấp access_token mới.
  // ─────────────────────────────────────────────
  async refresh(refreshToken: string) {
    const url = this.config.getOrThrow<string>('DIRECTUS_URL');

    // Gọi thẳng REST vì SDK authentication composable quản lý token nội bộ
    const response = await fetch(`${url}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const { data } = (await response.json()) as { data: DirectusAuthResult };
    return {
      message: 'Làm mới token thành công',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires: data.expires,
    };
  }

  // ─────────────────────────────────────────────
  // INTERNAL: gọi Directus POST /auth/login
  // ─────────────────────────────────────────────
  private async _directusLogin(email: string, password: string) {
    const url = this.config.getOrThrow<string>('DIRECTUS_URL');

    // Tạo client độc lập, stateless cho mỗi request login
    const authClient = createDirectus(url)
      .with(authentication('json'))
      .with(rest());

    let result: DirectusAuthResult;
    try {
      // Directus SDK: POST /auth/login → { access_token, refresh_token, expires }
      result = (await authClient.login({
        email,
        password,
      })) as DirectusAuthResult;
    } catch (err: any) {
      this.logger.warn(`Login thất bại cho ${email}: ${err?.message}`);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    let employeeData: any = null;
    try {
      const userClient = createDirectus(url)
        .with(staticToken(result.access_token))
        .with(rest());

      const me = await userClient.request(readMe({ fields: ['id', 'email'] }));

      const employees = await userClient.request(
        readItems('gw_employees', {
          filter: {
            directus_user_id: {
              _eq: me.id,
            },
          },
          limit: 1,
          fields: ['*', 'department_id.*', 'position_id.*'],
        }),
      );

      if (employees && employees.length > 0) {
        employeeData = employees[0];
      }
    } catch (err: any) {
      this.logger.warn(
        `Không thể lấy thông tin employee cho user ${email}: ${err?.message}`,
      );
    }

    return {
      message: 'Đăng nhập thành công',
      employee: employeeData,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires: result.expires,
    };
  }

  // ─────────────────────────────────────────────
  // LOGOUT
  // Frontend gửi refresh_token → Directus vô hiệu hóa token này.
  // ─────────────────────────────────────────────
  async logout(refreshToken: string) {
    const url = this.config.getOrThrow<string>('DIRECTUS_URL');

    const response = await fetch(`${url}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Ngay cả khi lỗi (token hết hạn), vẫn coi như logout thành công ở client
      this.logger.warn('Directus logout return non-ok status');
    }

    return {
      message: 'Đăng xuất thành công',
    };
  }

  // ─────────────────────────────────────────────
  // IMPERSONATE
  // Cho phép user có full quyền trên directus_roles đăng nhập thành user khác.
  // Trả về impersonation_token (JWT backend-signed, 8h).
  // Để "quay về", frontend dùng lại refresh_token gốc → POST /auth/refresh.
  // ─────────────────────────────────────────────
  async impersonate(
    caller: { id: string; email: string; role: string },
    targetUserId: string,
  ) {
    const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
    const adminToken = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');

    const adminFetch = async (path: string): Promise<any> => {
      const res = await fetch(`${directusUrl}${path}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? null;
    };

    // 1. Kiểm tra quyền: caller phải có full CRUD trên directus_roles
    const requiredActions = new Set(['read', 'create', 'update', 'delete']);
    let hasPermission = false;

    try {
      // Lấy tất cả permissions của caller (role + custom), kiểm tra directus_roles
      const allPerms: any[] = [];

      if (caller.role) {
        const roleAccess = await adminFetch(
          `/access?filter[role][_eq]=${caller.role}&filter[user][_null]=true`,
        );
        if (roleAccess && roleAccess.length > 0) {
          const rolePerms = await adminFetch(
            `/permissions?limit=-1&filter[policy][_eq]=${roleAccess[0].policy}&filter[collection][_eq]=directus_roles`,
          );
          if (rolePerms) allPerms.push(...rolePerms);
        }
      }

      const userAccess = await adminFetch(
        `/access?filter[user][_eq]=${caller.id}`,
      );
      if (userAccess && userAccess.length > 0) {
        const customPerms = await adminFetch(
          `/permissions?limit=-1&filter[policy][_eq]=${userAccess[0].policy}&filter[collection][_eq]=directus_roles`,
        );
        if (customPerms) allPerms.push(...customPerms);
      }

      const callerActions = new Set(allPerms.map((p: any) => p.action));
      hasPermission = [...requiredActions].every((a) => callerActions.has(a));
    } catch (err: any) {
      this.logger.warn(
        `Không thể kiểm tra quyền impersonate cho user ${caller.id}: ${err?.message}`,
      );
    }

    if (!hasPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền đăng nhập thành user khác',
      );
    }

    // 2. Ngăn tự impersonate chính mình
    if (caller.id === targetUserId) {
      throw new ForbiddenException('Không thể impersonate chính mình');
    }

    // 3. Lấy thông tin target user bằng admin token
    const targetUser = await adminFetch(
      `/users/${targetUserId}?fields=id,email,first_name,last_name,role,status`,
    );

    if (!targetUser) {
      throw new ForbiddenException('Không tìm thấy user đích');
    }

    if (targetUser.status !== 'active') {
      throw new ForbiddenException('User đích không còn active');
    }

    // 4. Ký impersonation token
    const secret = this.config.getOrThrow<string>('JWT_IMPERSONATION_SECRET');
    const impersonationToken = this.jwtService.sign(
      {
        type: 'impersonation',
        sub: targetUserId,
        originalUserId: caller.id,
      },
      { secret, expiresIn: '8h' },
    );

    this.logger.log(
      `User ${caller.email} (${caller.id}) impersonating ${targetUser.email} (${targetUserId})`,
    );

    return {
      message: 'Impersonation thành công',
      impersonation_token: impersonationToken,
      target_user: {
        id: targetUser.id,
        email: targetUser.email,
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
      },
    };
  }

  // ─────────────────────────────────────────────
  // UPDATE PROFILE
  // Chỉ cho phép user tự sửa full_name, phone, notes
  // Các field nhạy cảm (status, is_active, ...) bị chặn ở tầng DTO
  // ─────────────────────────────────────────────
  async updateProfile(
    directusUserId: string,
    dto: UpdateProfileDto,
  ): Promise<any> {
    const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
    const adminToken = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
    const adminClient = createDirectus(directusUrl)
      .with(staticToken(adminToken))
      .with(rest());

    // Tìm employee record của chính user này
    const employees = await (adminClient as any).request(
      (readItems as any)('gw_employees', {
        filter: { directus_user_id: { _eq: directusUserId } },
        limit: 1,
        fields: ['id'],
      }),
    );

    if (!employees || (employees as any[]).length === 0) {
      throw new InternalServerErrorException(
        'Không tìm thấy thông tin nhân viên của tài khoản này',
      );
    }

    const employeeId = (employees as any[])[0].id;

    // Chỉ update đúng 3 fields an toàn — dto đã strip hết field khác qua class-validator
    const payload: Record<string, any> = {};
    if (dto.full_name !== undefined) payload.full_name = dto.full_name;
    if (dto.phone !== undefined) payload.phone = dto.phone;
    if (dto.notes !== undefined) payload.notes = dto.notes;

    if (Object.keys(payload).length === 0) {
      throw new InternalServerErrorException(
        'Không có field nào được cập nhật',
      );
    }

    try {
      const updated = await (adminClient as any).request(
        (updateItem as any)('gw_employees', employeeId, payload),
      );
      return {
        message: 'Cập nhật thông tin thành công',
        data: updated,
      };
    } catch (err: any) {
      this.logger.error(
        `Lỗi updateProfile user ${directusUserId}: ${err?.message}`,
        err,
      );
      throw new InternalServerErrorException(
        'Không thể cập nhật thông tin, vui lòng thử lại',
      );
    }
  }

  // ─────────────────────────────────────────────
  // GET PROFILE
  // Trả về profile + role + rolePermissions + customPermissions + effectivePermissions
  // ─────────────────────────────────────────────
  async getProfileEmployee(userId: string): Promise<any> {
    const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
    const adminToken = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
    const adminClient = createDirectus(directusUrl)
      .with(staticToken(adminToken))
      .with(rest());

    const employees = await (adminClient as any).request(
      (readItems as any)('gw_employees', {
        filter: { directus_user_id: { _eq: userId } },
        limit: 1,
        fields: ['*', 'department_id.*', 'position_id.*'],
      }),
    );

    return employees && (employees as any[]).length > 0
      ? (employees as any[])[0]
      : null;
  }

  async getProfile(user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    _impersonatedBy?: string;
  }): Promise<any> {
    const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
    const adminToken = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');

    const adminFetch = async (path: string): Promise<any> => {
      const res = await fetch(`${directusUrl}${path}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? null;
    };

    // 1. Employee data của chính user (lookup nội bộ, không phụ thuộc quyền đọc danh mục employee)
    let employee: any = null;
    try {
      employee = await this.getProfileEmployee(user.id);
    } catch (err: any) {
      this.logger.warn(
        `Không thể lấy employee cho user ${user.id}: ${err?.message}`,
      );
    }

    // 2. Role info + Role permissions (song song)
    let roleInfo: any = null;
    let rawRolePerms: any[] = [];
    if (user.role) {
      try {
        const [roleData, roleAccess] = await Promise.all([
          adminFetch(`/roles/${user.role}?fields=id,name,icon,description`),
          adminFetch(
            `/access?filter[role][_eq]=${user.role}&filter[user][_null]=true`,
          ),
        ]);
        roleInfo = roleData;
        if (roleAccess && roleAccess.length > 0) {
          const perms = await adminFetch(
            `/permissions?limit=-1&filter[policy][_eq]=${roleAccess[0].policy}`,
          );
          rawRolePerms = perms ?? [];
        }
      } catch (err: any) {
        this.logger.warn(
          `Không thể lấy role permissions cho role ${user.role}: ${err?.message}`,
        );
      }
    }

    // 3. Custom permissions riêng của user
    let rawCustomPerms: any[] = [];
    try {
      const userAccess = await adminFetch(
        `/access?filter[user][_eq]=${user.id}`,
      );
      if (userAccess && userAccess.length > 0) {
        const perms = await adminFetch(
          `/permissions?limit=-1&filter[policy][_eq]=${userAccess[0].policy}`,
        );
        rawCustomPerms = perms ?? [];
      }
    } catch (err: any) {
      this.logger.warn(
        `Không thể lấy custom permissions cho user ${user.id}: ${err?.message}`,
      );
    }

    // 4. Impersonation metadata (nếu đang trong session impersonate)
    let impersonation: {
      active: boolean;
      actor?: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
      };
    } = { active: false };

    if (user._impersonatedBy) {
      let actor: any = null;
      try {
        actor = await adminFetch(
          `/users/${user._impersonatedBy}?fields=id,email,first_name,last_name`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Không thể lấy actor info khi impersonate: ${err?.message}`,
        );
      }
      impersonation = {
        active: true,
        actor: actor
          ? {
              id: actor.id,
              email: actor.email,
              first_name: actor.first_name,
              last_name: actor.last_name,
            }
          : undefined,
      };
    }

    return {
      profile: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: roleInfo,
      },
      employee,
      impersonation,
      rolePermissions: this._groupByCollection(rawRolePerms),
      customPermissions: this._groupByCollection(rawCustomPerms),
      effectivePermissions: this._buildEffective(rawRolePerms, rawCustomPerms),
    };
  }

  // Group raw Directus permissions thành { collection, actions[], details[] }
  private _groupByCollection(perms: any[]): CollectionPermission[] {
    const map = new Map<string, CollectionPermission>();
    for (const p of perms) {
      if (!map.has(p.collection)) {
        map.set(p.collection, {
          collection: p.collection,
          actions: [],
          details: [],
        });
      }
      const entry = map.get(p.collection)!;
      entry.actions.push(p.action);
      entry.details.push({
        action: p.action,
        fields: p.fields ?? null,
        permissions: p.permissions ?? null,
        validation: p.validation ?? null,
      });
    }
    return Array.from(map.values());
  }

  // Merge role + custom permissions theo key collection:action
  // Cùng collection + cùng action → custom thắng
  // Cùng collection + khác action → giữ cả hai (user có cả hai quyền)
  private _buildEffective(
    rolePerms: any[],
    customPerms: any[],
  ): CollectionPermission[] {
    const flatMap = new Map<string, any>();
    for (const p of rolePerms) {
      flatMap.set(`${p.collection}:${p.action}`, {
        ...p,
        source: 'role' as const,
      });
    }
    for (const p of customPerms) {
      flatMap.set(`${p.collection}:${p.action}`, {
        ...p,
        source: 'custom' as const,
      });
    }

    const collMap = new Map<string, CollectionPermission>();
    for (const p of flatMap.values()) {
      if (!collMap.has(p.collection)) {
        collMap.set(p.collection, {
          collection: p.collection,
          actions: [],
          details: [],
        });
      }
      const entry = collMap.get(p.collection)!;
      entry.actions.push(p.action);
      entry.details.push({
        action: p.action,
        fields: p.fields ?? null,
        permissions: p.permissions ?? null,
        validation: p.validation ?? null,
        source: p.source,
      });
    }
    return Array.from(collMap.values());
  }

  // ─────────────────────────────────────────────
  // CHANGE PASSWORD
  // Đổi mật khẩu cho user đang đăng nhập
  // ─────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    try {
      await (this.directus as any).request(
        updateUser(userId, { password: dto.new_password }),
      );
      return { message: 'Đổi mật khẩu thành công' };
    } catch (err: any) {
      this.logger.error(`Lỗi khi đổi mật khẩu user ${userId}`, err);
      throw new InternalServerErrorException(
        'Không thể đổi mật khẩu, vui lòng thử lại sau',
      );
    }
  }
}
