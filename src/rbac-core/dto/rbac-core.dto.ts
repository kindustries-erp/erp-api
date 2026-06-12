export class CreateCoreRoleDto {
  name: string;
  description?: string;
}

export class UpdateCoreRoleDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export class CorePermissionDto {
  resource: string;
  action: string;
  conditions?: any;
}

export class UpdateCoreRolePermissionsDto {
  permissions: CorePermissionDto[];
}

export class UpdateCoreRoleUsersDto {
  userIds: string[];
}
