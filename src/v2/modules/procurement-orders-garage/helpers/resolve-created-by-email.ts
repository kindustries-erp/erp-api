import { In, Repository } from 'typeorm';
import { CoreUser } from '../../../../users/entities/core-user.entity';

/** Tìm email theo danh sách id người dùng bằng một truy vấn. Id không tồn tại bị bỏ qua. */
export async function resolveCreatedByEmails(
  users: Pick<Repository<CoreUser>, 'find'>,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return emails;
  const rows = await users.find({
    where: { id: In(unique) },
    select: { id: true, email: true },
  });
  for (const row of rows) emails.set(row.id, row.email);
  return emails;
}
