import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import dataSource from './db/data-source';
import { CoreUser } from './users/entities/core-user.entity';
import { CoreRole } from './rbac-core/entities/core-role.entity';
import { CorePermission } from './rbac-core/entities/core-permission.entity';
import { CoreUserRole } from './rbac-core/entities/core-user-role.entity';

async function seedAdminFull() {
  await dataSource.initialize();
  console.log('Database connected!');

  const userRepo = dataSource.getRepository(CoreUser);
  const roleRepo = dataSource.getRepository(CoreRole);
  const permRepo = dataSource.getRepository(CorePermission);
  const userRoleRepo = dataSource.getRepository(CoreUserRole);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      'Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in environment variables',
    );
    process.exit(1);
  }

  let adminUser = await userRepo.findOne({ where: { email: adminEmail } });

  if (!adminUser) {
    console.log(`User ${adminEmail} not found, creating new admin user...`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    adminUser = userRepo.create({
      email: adminEmail,
      passwordHash: passwordHash,
      status: 'ACTIVE',
    });

    await userRepo.save(adminUser);
    console.log(`Created admin user with email: ${adminEmail}`);
  } else {
    console.log(
      `User ${adminEmail} already exists, proceeding to role check...`,
    );
  }

  let adminRole = await roleRepo.findOne({ where: { name: 'Admin' } });
  if (!adminRole) {
    adminRole = roleRepo.create({
      name: 'Admin',
      description: 'System Administrator (Full Access)',
      isActive: true,
    });
    await roleRepo.save(adminRole);
    console.log('Created Admin role');
  } else {
    console.log('Admin role already exists');
  }

  let wildcardPerm = await permRepo.findOne({
    where: { roleId: adminRole.id, resource: '*', action: '*' },
  });
  if (!wildcardPerm) {
    wildcardPerm = permRepo.create({
      roleId: adminRole.id,
      resource: '*',
      action: '*',
    });
    await permRepo.save(wildcardPerm);
    console.log('Granted wildcard permission (*:*) to Admin role');
  } else {
    console.log('Wildcard permission already granted to Admin role');
  }

  let userRole = await userRoleRepo.findOne({
    where: { userId: adminUser.id, roleId: adminRole.id },
  });
  if (!userRole) {
    userRole = userRoleRepo.create({
      userId: adminUser.id,
      roleId: adminRole.id,
    });
    await userRoleRepo.save(userRole);
    console.log(`Assigned Admin role to ${adminEmail}`);
  } else {
    console.log(`Admin role already assigned to ${adminEmail}`);
  }

  console.log('Seeding done!');
  process.exit(0);
}

seedAdminFull().catch((error) => {
  console.error(error);
  process.exit(1);
});
