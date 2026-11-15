/** Hợp đồng phản hồi auth v2. Không có `passwordHash`. */
export interface AuthUserDto {
  id: string;
  email: string;
  status: string;
  employeeId: string | null;
  legacyDirectusUserId: string | null;
}

export interface AuthPreferencesDto {
  theme: unknown;
  language: unknown;
  tableConfigs: unknown;
  uiConfigs: unknown;
}

export interface LoginResultDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: AuthUserDto;
  preferences: AuthPreferencesDto;
}

export interface RefreshResultDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface ProfileEmployeeDto {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  userId: string | null;
}

export interface ProfileDto extends AuthUserDto {
  employee: ProfileEmployeeDto | null;
  permissions: { resource: string; action: string; conditions: unknown }[];
  preferences: AuthPreferencesDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatedProfileDto {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  notes: string | null;
}
