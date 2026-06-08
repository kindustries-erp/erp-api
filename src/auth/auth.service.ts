import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const seedAdminEmail = this.configService.get<string>('SEED_ADMIN_EMAIL');
    const seedAdminPassword = this.configService.get<string>('SEED_ADMIN_PASSWORD');

    if (!seedAdminEmail || !seedAdminPassword) {
      return;
    }

    try {
      await this.usersService.createSeedUserIfMissing(
        seedAdminEmail,
        seedAdminPassword,
      );
    } catch {
      // Skip bootstrap failure here; DB may not be configured yet.
    }
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !this.usersService.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        employeeId: user.employeeId,
        legacyDirectusUserId: user.legacyDirectusUserId,
      },
    };
  }

  async registerLocalUser(input: {
    email: string;
    password: string;
    employeeId?: string;
  }) {
    return this.usersService.registerLocalUser(input);
  }

  async profile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const employee = await this.usersService.getEmployeeSnapshot(user.employeeId);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      employeeId: user.employeeId,
      legacyDirectusUserId: user.legacyDirectusUserId,
      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            email: employee.email,
            phone: employee.phone,
            status: employee.status,
            userId: employee.userId,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
