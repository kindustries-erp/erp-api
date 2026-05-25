import { ConfigService } from '@nestjs/config';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  UnauthorizedException,
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  createDirectus,
  updateItem,
  readItem,
  rest,
  staticToken,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { UpdateRolePermissionsDto } from '../rbac/dto/update-permission.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  async findAll(query: PaginationDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
      const token = userToken;

      // Dùng native fetch để gọi thẳng REST API và lấy cả block "meta"
      const url = new URL(`/items/erp_employees`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      url.searchParams.append('fields[]', '*');
      url.searchParams.append('fields[]', 'department_id.*');
      url.searchParams.append('fields[]', 'position_id.*');
      url.searchParams.append('fields[]', 'directus_user_id.id');
      url.searchParams.append('fields[]', 'directus_user_id.role.*');
      if (query.search) {
        url.searchParams.append('search', query.search);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách nhân viên',
        );
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      const totalPages = Math.ceil(total / pageSize);

      // Format chuẩn PaginatedResponse
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách nhân viên', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách nhân viên',
      );
    }
  }

  async update(id: string, updateEmployeeDto: any, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());

    // Extract policy_id and role_id to handle them separately
    const { policy_id, role_id, ...employeeData } = updateEmployeeDto;

    try {
      // 1. Cập nhật employee data
      const updatedEmployee = await (userClient as any).request(
        (updateItem as any)('erp_employees', id, employeeData),
      );

      const adminToken = this.configService.get<string>('DIRECTUS_ADMIN_TOKEN');

      const doAdminRequest = async (
        method: string,
        path: string,
        body?: any,
      ) => {
        const res = await fetch(`${directusUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(await res.text());
        if (method !== 'DELETE') {
          const json = await res.json();
          return json.data;
        }
        return null;
      };

      // 2. Cập nhật policy cho user (nếu có yêu cầu từ client)
      if (policy_id !== undefined) {
        // Lấy directus_user_id của employee này
        const employee = await (userClient as any).request(
          (readItem as any)('erp_employees', id, {
            fields: ['directus_user_id'],
          }),
        );
        const directusUserId = employee?.directus_user_id;

        if (directusUserId) {
          // Lấy các policy access mapping hiện tại của user
          const existingAccess = await doAdminRequest(
            'GET',
            `/access?filter[user][_eq]=${directusUserId}`,
          );

          if (policy_id === null) {
            // Xóa hết policy gán riêng cho user này
            for (const access of existingAccess || []) {
              await doAdminRequest('DELETE', `/access/${access.id}`);
            }
          } else {
            // Cập nhật hoặc tạo mới policy mapping
            if (existingAccess && existingAccess.length > 0) {
              await doAdminRequest('PATCH', `/access/${existingAccess[0].id}`, {
                policy: policy_id,
              });
              // Xóa bớt nếu lỡ có nhiều mapping thừa
              for (let i = 1; i < existingAccess.length; i++) {
                await doAdminRequest(
                  'DELETE',
                  `/access/${existingAccess[i].id}`,
                );
              }
            } else {
              await doAdminRequest('POST', '/access', {
                user: directusUserId,
                policy: policy_id,
                sort: 1,
              });
            }
          }
        }
      }

      // 3. Cập nhật base role cho user (nếu có yêu cầu từ client)
      if (role_id !== undefined) {
        let directusUserId: string | null = null;
        if (policy_id === undefined) {
          // If policy_id was defined, we already fetched it
          const employee = await (userClient as any).request(
            (readItem as any)('erp_employees', id, {
              fields: ['directus_user_id'],
            }),
          );
          directusUserId = employee?.directus_user_id;
        } else {
          const employee = await (userClient as any).request(
            (readItem as any)('erp_employees', id, {
              fields: ['directus_user_id'],
            }),
          );
          directusUserId = employee?.directus_user_id;
        }

        if (directusUserId) {
          await doAdminRequest('PATCH', `/users/${directusUserId}`, {
            role: role_id,
          });
        }
      }

      return {
        message: 'Cập nhật thông tin nhân viên thành công',
        data: updatedEmployee,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi cập nhật employee ${id}: ${error?.message || String(error)}`,
        error?.errors || error,
      );
      throw new InternalServerErrorException(
        error?.message || 'Không thể cập nhật thông tin nhân viên',
      );
    }
  }

  async findOne(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      // Gọi Directus SDK để lấy chi tiết 1 bản ghi trong collection employees
      const employee = await (userClient as any).request(
        (readItem as any)('erp_employees', id, {
          fields: [
            '*',
            'department_id.*',
            'position_id.*',
            'directus_user_id.id',
            'directus_user_id.role.*',
          ],
        }),
      );

      return {
        message: 'Lấy thông tin nhân viên thành công',
        data: employee,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin employee ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin nhân viên',
      );
    }
  }

  async getEmployeePermissions(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());

    try {
      // 1. Get user id from employee
      const employee = await (userClient as any).request(
        (readItem as any)('erp_employees', id, {
          fields: ['directus_user_id'],
        }),
      );
      const directusUserId = employee?.directus_user_id;

      if (!directusUserId) {
        return { permissions: [] };
      }

      // 2. Fetch directus_access for user (with admin token)
      const urlAccess = new URL(`/access`, directusUrl);
      urlAccess.searchParams.append('filter[user][_eq]', directusUserId);
      const resAccess = await fetch(urlAccess.toString(), {
        headers: {
          Authorization: `Bearer ${this.configService.get<string>('DIRECTUS_ADMIN_TOKEN')}`,
        },
      });
      const accessJson = await resAccess.json();
      const accessRecords = accessJson.data;

      if (!accessRecords || accessRecords.length === 0) {
        return { permissions: [] };
      }

      const policyId = accessRecords[0].policy;

      // 3. Fetch permissions for that policy
      const urlPerms = new URL(`/permissions`, directusUrl);
      urlPerms.searchParams.append('limit', '-1');
      urlPerms.searchParams.append('filter[policy][_eq]', policyId);
      const resPerms = await fetch(urlPerms.toString(), {
        headers: {
          Authorization: `Bearer ${this.configService.get<string>('DIRECTUS_ADMIN_TOKEN')}`,
        },
      });
      const permsJson = await resPerms.json();
      const perms = permsJson.data;

      return { permissions: perms || [] };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy quyền của employee ${id}: ${error?.message || JSON.stringify(error)}`,
        error?.errors || error,
      );
      throw new InternalServerErrorException(
        error?.message || 'Không thể lấy quyền nhân viên',
      );
    }
  }

  async updateEmployeePermissions(
    id: string,
    payload: UpdateRolePermissionsDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());

    try {
      // 1. Get user id from employee
      const employee = await (userClient as any).request(
        (readItem as any)('erp_employees', id, {
          fields: ['directus_user_id', 'full_name'],
        }),
      );
      const directusUserId = employee?.directus_user_id;

      if (!directusUserId) {
        throw new Error(
          'Nhân viên này chưa được liên kết với tài khoản hệ thống',
        );
      }

      const adminToken = this.configService.get<string>('DIRECTUS_ADMIN_TOKEN');

      const doAdminRequest = async (
        method: string,
        path: string,
        body?: any,
      ) => {
        const res = await fetch(`${directusUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(await res.text());
        if (method !== 'DELETE') {
          const json = await res.json();
          return json.data;
        }
        return null;
      };

      // 2. Get or create Policy for this User
      let policyId: string;
      const accessRecords = await doAdminRequest(
        'GET',
        `/access?filter[user][_eq]=${directusUserId}`,
      );

      if (accessRecords && accessRecords.length > 0) {
        policyId = accessRecords[0].policy;
      } else {
        // Create a new policy
        const policyName = `Policy for ${employee.full_name || 'Employee'}`;
        const newPolicy = await doAdminRequest('POST', '/policies', {
          name: policyName,
          admin_access: false,
          app_access: true,
        });
        policyId = newPolicy.id;

        // Map user to policy
        await doAdminRequest('POST', '/access', {
          user: directusUserId,
          policy: policyId,
        });
      }

      // 3. Query existing permissions for this policy
      const existingPerms = await doAdminRequest(
        'GET',
        `/permissions?limit=-1&filter[policy][_eq]=${policyId}`,
      );

      // 4. Process the payload
      for (const item of payload.permissions) {
        const existing = existingPerms.find(
          (p: any) =>
            p.collection === item.collection && p.action === item.action,
        );

        if (item.access === false) {
          if (existing) {
            // Delete
            await doAdminRequest('DELETE', `/permissions/${existing.id}`);
          }
        } else {
          const permPayload: any = {};
          if (item.fields !== undefined)
            permPayload.fields = Array.isArray(item.fields)
              ? item.fields
              : [item.fields];
          if (item.permissions !== undefined)
            permPayload.permissions = item.permissions;
          if (item.validation !== undefined)
            permPayload.validation = item.validation;

          if (existing) {
            // Update
            await doAdminRequest(
              'PATCH',
              `/permissions/${existing.id}`,
              permPayload,
            );
          } else {
            // Create
            await doAdminRequest('POST', '/permissions', {
              policy: policyId,
              collection: item.collection,
              action: item.action,
              ...permPayload,
            });
          }
        }
      }

      return { success: true, message: 'Cập nhật quyền thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật quyền cho employee ${id}`, error);
      throw new InternalServerErrorException(
        error?.message || 'Không thể cập nhật quyền nhân viên',
      );
    }
  }
}
