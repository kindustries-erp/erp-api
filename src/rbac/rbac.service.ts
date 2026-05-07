import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  UpdateRolePermissionsDto,
} from './dto/update-permission.dto';
import { UpdateRoleUsersDto } from './dto/update-role-users.dto';

export interface DirectusResponse<T> {
  data: T;
  meta?: {
    filter_count?: number;
  };
}

export interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface DirectusRole {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  users?: Partial<DirectusUser>[];
}

export interface DirectusPolicy {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  admin_access: boolean;
  app_access: boolean;
}

export interface DirectusPermission {
  id: string;
  collection: string;
  action: string;
  permissions: Record<string, any> | null;
  validation: Record<string, any> | null;
  presets: Record<string, any> | null;
  fields: string[] | string | null;
  policy: string;
}

export interface DirectusAccess {
  id: string;
  role: string | null;
  user: string | null;
  policy: string;
  sort: number | null;
}

export interface DirectusField {
  collection: string;
  field: string;
  type: string;
  schema: Record<string, any> | null;
  meta: Record<string, any> | null;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
    this.token = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Directus API Error [${method} ${path}]: ${errorText}`);
      throw new HttpException(errorText, res.status);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = (await res.json()) as DirectusResponse<T>;
      return json.data;
    }
    return null as T;
  }

  private async resolveDirectusUserIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)];
    const directusUsers = await this.request<DirectusUser[]>(
      'GET',
      `/users?filter[id][_in]=${uniqueIds.join(',')}&fields=id&limit=-1`,
    );
    const directusUserIds = new Set(
      (directusUsers || []).map((user) => user.id),
    );
    const unresolvedIds = uniqueIds.filter((id) => !directusUserIds.has(id));

    if (unresolvedIds.length === 0) {
      return uniqueIds;
    }

    const employees = await this.request<
      { id: string; directus_user_id: string | { id: string } | null }[]
    >(
      'GET',
      `/items/gw_employees?filter[id][_in]=${unresolvedIds.join(',')}&fields=id,directus_user_id&limit=-1`,
    );
    const employeeUserIds = (employees || [])
      .map((employee) => {
        const directusUser = employee.directus_user_id;
        return typeof directusUser === 'string'
          ? directusUser
          : (directusUser as { id: string })?.id;
      })
      .filter(Boolean);

    return [...new Set([...directusUserIds, ...employeeUserIds])];
  }

  async getRoles() {
    return this.request<DirectusRole[]>(
      'GET',
      '/roles?limit=-1&fields=id,name,icon,description',
    );
  }

  async getRolesPaginated(query: {
    page?: number | string;
    pageSize?: number | string;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, search } = query;
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    let url = `/roles?limit=${limit}&offset=${offset}&meta=filter_count`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }

    const res = await fetch(`${this.baseUrl}${url}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (!res.ok) throw new HttpException(await res.text(), res.status);
    const json = (await res.json()) as DirectusResponse<DirectusRole[]>;
    const items = json.data || [];

    if (items.length > 0) {
      const roleIds = items.map((r) => r.id).join(',');
      const users = await this.request<DirectusUser[]>(
        'GET',
        `/users?filter[role][_in]=${roleIds}&fields=id,email,first_name,last_name,role&limit=-1`,
      );
      const usersByRole = new Map<string, Partial<DirectusUser>[]>();
      for (const u of users || []) {
        if (!usersByRole.has(u.role)) usersByRole.set(u.role, []);
        usersByRole.get(u.role)!.push({
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
        });
      }
      items.forEach((role) => {
        role.users = usersByRole.get(role.id) || [];
      });
    }

    return {
      items,
      total: json.meta?.filter_count ?? 0,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil((json.meta?.filter_count ?? 0) / limit),
    };
  }

  async createRole(dto: any) {
    return this.request('POST', '/roles', dto);
  }

  async updateRole(id: string, dto: any) {
    return this.request('PATCH', `/roles/${id}`, dto);
  }

  async deleteRole(id: string) {
    return this.request('DELETE', `/roles/${id}`);
  }

  async getPolicies() {
    return this.request<DirectusPolicy[]>(
      'GET',
      '/policies?limit=-1&fields=id,name,icon,description,admin_access,app_access',
    );
  }

  async getPermissions() {
    return this.request<DirectusPermission[]>(
      'GET',
      '/permissions?limit=-1&fields=id,collection,action,permissions,validation,presets,fields,policy',
    );
  }

  async getPermission(id: string) {
    return this.request<DirectusPermission>(
      'GET',
      `/permissions/${encodeURIComponent(id)}?fields=id,collection,action,permissions,validation,presets,fields,policy`,
    );
  }

  async createPermission(dto: CreatePermissionDto) {
    const payload = this.buildPermissionPayload(dto);
    return this.request<DirectusPermission>('POST', '/permissions', payload);
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const payload = this.buildPermissionPayload(dto);
    return this.request<DirectusPermission>(
      'PATCH',
      `/permissions/${encodeURIComponent(id)}`,
      payload,
    );
  }

  async deletePermission(id: string) {
    return this.request('DELETE', `/permissions/${encodeURIComponent(id)}`);
  }

  async getCollectionFields(collection: string) {
    const fields = await this.request<DirectusField[]>(
      'GET',
      `/fields/${encodeURIComponent(collection)}?limit=-1&fields=collection,field,type,schema,meta`,
    );

    return {
      collection,
      fields: (fields || []).map((item) => ({
        field: item.field,
        name: item.meta?.name || item.field,
        type: item.type,
        interface: item.meta?.interface ?? null,
        hidden: item.meta?.hidden ?? false,
        readonly: item.meta?.readonly ?? false,
        required: item.meta?.required ?? false,
        special: item.meta?.special ?? null,
        sort: item.meta?.sort ?? null,
        schema: item.schema,
        meta: item.meta,
      })),
    };
  }

  async getPermissionEditor(id: string) {
    const permission = await this.getPermission(id);
    const availableFields = await this.getCollectionFields(
      permission.collection,
    );

    return {
      permission,
      availableFields: availableFields.fields,
      isAllFields:
        permission.fields === '*' ||
        (Array.isArray(permission.fields) && permission.fields.includes('*')),
    };
  }

  private buildPermissionPayload(
    dto: Partial<CreatePermissionDto & UpdatePermissionDto>,
  ): Partial<DirectusPermission> {
    const payload: Partial<DirectusPermission> = {};

    if (dto.policy !== undefined) payload.policy = dto.policy;
    if (dto.collection !== undefined) payload.collection = dto.collection;
    if (dto.action !== undefined) payload.action = dto.action;
    if (dto.fields !== undefined) payload.fields = dto.fields;
    if (dto.permissions !== undefined) payload.permissions = dto.permissions;
    if (dto.validation !== undefined) payload.validation = dto.validation;
    if (dto.presets !== undefined) payload.presets = dto.presets;

    return payload;
  }

  async getAccess() {
    return this.request<DirectusAccess[]>(
      'GET',
      '/access?limit=-1&fields=id,role,user,policy,sort',
    );
  }

  async getRbacTable() {
    const [roles, policies, permissions, access, allUsers] = await Promise.all([
      this.getRoles(),
      this.getPolicies(),
      this.getPermissions(),
      this.getAccess(),
      this.request<DirectusUser[]>(
        'GET',
        '/users?fields=id,email,first_name,last_name,role&limit=-1',
      ),
    ]);

    return roles.map((role) => {
      const roleAccess = access.filter((a) => a.role === role.id && !a.user);
      const rolePolicies = policies.filter((p) =>
        roleAccess.some((a) => a.policy === p.id),
      );
      const rolePermissions = permissions.filter((perm) =>
        rolePolicies.some((p) => p.id === perm.policy),
      );
      const roleUsers = (allUsers || [])
        .filter((u) => u.role === role.id)
        .map((u) => ({
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
        }));

      return {
        roleId: role.id,
        roleName: role.name,
        icon: role.icon,
        description: role.description,
        users: roleUsers,
        policies: rolePolicies,
        permissions: rolePermissions,
      };
    });
  }

  async getRolePermissions(roleId: string) {
    const accessRecords = await this.request<DirectusAccess[]>(
      'GET',
      `/access?filter[role][_eq]=${roleId}&filter[user][_null]=true`,
    );
    if (!accessRecords || accessRecords.length === 0) {
      return { permissions: [] };
    }
    const policyId = accessRecords[0].policy;
    const perms = await this.request<DirectusPermission[]>(
      'GET',
      `/permissions?limit=-1&filter[policy][_eq]=${policyId}`,
    );
    return { permissions: perms || [] };
  }

  async updateRolePermissions(
    roleId: string,
    payload: UpdateRolePermissionsDto,
  ) {
    this.logger.log(`Update permissions for role ${roleId}`);

    // 1. Get or create Policy for this Role
    let policyId: string;
    const accessRecords = await this.request<DirectusAccess[]>(
      'GET',
      `/access?filter[role][_eq]=${roleId}&filter[user][_null]=true`,
    );

    if (accessRecords && accessRecords.length > 0) {
      policyId = accessRecords[0].policy;
    } else {
      // Create a new policy
      const roleRes = await this.request<DirectusRole>(
        'GET',
        `/roles/${roleId}?fields=name`,
      );
      const policyName = `Policy for ${roleRes?.name || roleId}`;
      const newPolicy = await this.request<DirectusPolicy>(
        'POST',
        '/policies',
        {
          name: policyName,
          admin_access: false,
          app_access: true,
        },
      );
      policyId = newPolicy.id;

      // Map role to policy
      await this.request<DirectusAccess>('POST', '/access', {
        role: roleId,
        policy: policyId,
      });
    }

    // 2. Query existing permissions for this policy
    const existingPerms = await this.request<DirectusPermission[]>(
      'GET',
      `/permissions?limit=-1&filter[policy][_eq]=${policyId}`,
    );

    // 3. Process the payload
    for (const item of payload.permissions) {
      const existing = existingPerms.find(
        (p) => p.collection === item.collection && p.action === item.action,
      );

      if (item.access === false) {
        if (existing) {
          // Delete
          await this.request('DELETE', `/permissions/${existing.id}`);
        }
      } else {
        const permPayload: Partial<DirectusPermission> = {};
        if (item.fields !== undefined)
          permPayload.fields = Array.isArray(item.fields)
            ? item.fields
            : [item.fields];
        if (item.permissions !== undefined)
          permPayload.permissions = item.permissions as Record<string, any>;
        if (item.validation !== undefined)
          permPayload.validation = item.validation as Record<string, any>;
        if (item.presets !== undefined)
          permPayload.presets = item.presets as Record<string, any>;

        if (existing) {
          // Update
          await this.request(
            'PATCH',
            `/permissions/${existing.id}`,
            permPayload,
          );
        } else {
          // Create
          await this.request('POST', '/permissions', {
            policy: policyId,
            collection: item.collection,
            action: item.action,
            ...permPayload,
          });
        }
      }
    }

    return { success: true, message: 'Cập nhật quyền thành công' };
  }

  async getRoleUsers(roleId: string) {
    const users = await this.request<DirectusUser[]>(
      'GET',
      `/users?filter[role][_eq]=${roleId}&fields=id,email,first_name,last_name,role&limit=-1`,
    );
    return {
      users: (users || []).map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
      })),
    };
  }

  async updateRoleUsers(roleId: string, dto: UpdateRoleUsersDto) {
    const userIds = await this.resolveDirectusUserIds(dto.userIds);
    const currentUsers = await this.request<DirectusUser[]>(
      'GET',
      `/users?filter[role][_eq]=${roleId}&fields=id&limit=-1`,
    );
    const currentIds = new Set((currentUsers || []).map((u) => u.id));
    const newIds = new Set(userIds);

    const toAdd = userIds.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !newIds.has(id));

    await Promise.all([
      ...toAdd.map((id) =>
        this.request('PATCH', `/users/${id}`, { role: roleId }),
      ),
      ...toRemove.map((id) =>
        this.request('PATCH', `/users/${id}`, { role: null }),
      ),
    ]);

    const result = await this.getRoleUsers(roleId);
    return {
      success: true,
      message: 'Cập nhật user trong role thành công',
      users: result.users,
      resolvedUserIds: userIds,
    };
  }
}
