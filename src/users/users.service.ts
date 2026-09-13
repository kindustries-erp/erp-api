import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { Repository } from 'typeorm';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { CoreUser } from './entities/core-user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly usersRepository: Repository<CoreUser>,
    @InjectRepository(ErpEmployee)
    private readonly employeesRepository: Repository<ErpEmployee>,
  ) {}

  hashPassword(password: string) {
    const salt = genSaltSync(10);
    return hashSync(password, salt);
  }

  verifyPassword(password: string, passwordHash: string) {
    return compareSync(password, passwordHash);
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async createSeedUserIfMissing(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) return existing;

    const user = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      status: 'ACTIVE',
      employeeId: null,
      legacyDirectusUserId: null,
    });
    return this.usersRepository.save(user);
  }

  async registerLocalUser(input: {
    email: string;
    password: string;
    employeeId?: string;
  }) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    let employee: ErpEmployee | null = null;
    if (input.employeeId) {
      employee = await this.employeesRepository.findOne({
        where: { id: input.employeeId },
      });
      if (!employee) {
        throw new NotFoundException('Không tìm thấy employee để liên kết');
      }
    }

    const savedUser = await this.usersRepository.save(
      this.usersRepository.create({
        email,
        passwordHash: this.hashPassword(input.password),
        status: 'ACTIVE',
        employeeId: employee?.id ?? null,
        legacyDirectusUserId: null,
      }),
    );

    if (employee && employee.userId !== savedUser.id) {
      employee.userId = savedUser.id;
      if (!employee.email) {
        employee.email = email;
      }
      await this.employeesRepository.save(employee);
    }

    return {
      message: 'Tạo user local thành công',
      data: {
        id: savedUser.id,
        email: savedUser.email,
        status: savedUser.status,
        employeeId: savedUser.employeeId,
        legacyDirectusUserId: savedUser.legacyDirectusUserId,
      },
    };
  }

  async getEmployeeSnapshot(employeeId: string | null) {
    if (!employeeId) return null;
    return this.employeesRepository.findOne({ where: { id: employeeId } });
  }

  async saveEmployee(employee: ErpEmployee): Promise<ErpEmployee> {
    return this.employeesRepository.save(employee);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    } as any);
  }

  async save(user: CoreUser): Promise<CoreUser> {
    return this.usersRepository.save(user);
  }
}
