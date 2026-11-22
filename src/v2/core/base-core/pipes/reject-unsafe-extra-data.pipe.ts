import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { explainExtraDataError } from '../helpers/extra-data.util';

/**
 * Kiểm mọi `extraData` trong body thô, trước ValidationPipe.
 * ValidationPipe của Nest tự xóa key `__proto__` ở mọi cấp, nên nếu không kiểm ở đây
 * payload chứa khóa cấm sẽ bị bỏ lặng lẽ (201) thay vì trả 400.
 * Đăng ký trong main.ts TRƯỚC ValidationPipe.
 */
@Injectable()
export class RejectUnsafeExtraDataPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body') assertNoUnsafeExtraData(value);
    return value;
  }
}

/** Duyệt không đệ quy (tránh tràn stack với JSON lồng sâu). Không đi vào bên trong `extraData`: đã kiểm trọn gói. */
export function assertNoUnsafeExtraData(root: unknown): void {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key];
      if (key === 'extraData') {
        if (child === undefined) continue;
        const error = explainExtraDataError(child);
        if (error) throw new BadRequestException(error);
        continue;
      }
      stack.push(child);
    }
  }
}
