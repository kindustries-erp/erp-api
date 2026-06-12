import 'dotenv/config';
import { DataSource } from 'typeorm';
import dataSource from './db/data-source';
import { CoreUser } from './users/entities/core-user.entity';
import { CoreRole } from './rbac-core/entities/core-role.entity';
import { CorePermission } from './rbac-core/entities/core-permission.entity';
import { CoreUserRole } from './rbac-core/entities/core-user-role.entity';

async function seed() {
  await dataSource.initialize();
  console.log('Database connected!');

  const userRepo = dataSource.getRepository(CoreUser);
  const roleRepo = dataSource.getRepository(CoreRole);
  const permRepo = dataSource.getRepository(CorePermission);
  const userRoleRepo = dataSource.getRepository(CoreUserRole);

  const adminEmail = 'admin@liouni.com';
  let adminUser = await userRepo.findOne({ where: { email: adminEmail } });

  if (!adminUser) {
    console.log(`User ${adminEmail} not found!`);
    // Create it? No, the user might have a different email, but they asked for admin@liouni.com. Let's assume it exists.
    process.exit(1);
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
  }

  console.log('Seeding done!');
  process.exit(0);
}

seed().catch(console.error);
