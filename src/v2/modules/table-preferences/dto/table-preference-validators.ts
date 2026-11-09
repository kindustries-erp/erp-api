import { ValidateBy } from 'class-validator';
import { TABLE_PREFERENCE_LIMITS } from './table-preference-limits';

/** Object có tối đa `max` khóa và mọi giá trị thỏa `check` */
export function IsBoundedRecord(
  check: (value: unknown) => boolean,
  typeName: string,
): PropertyDecorator {
  return ValidateBy({
    name: 'isBoundedRecord',
    constraints: [typeName],
    validator: {
      validate: (value: unknown) =>
        value === undefined ||
        (typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.keys(value).length <= TABLE_PREFERENCE_LIMITS.recordKeysMax &&
          Object.values(value).every(check)),
      defaultMessage: () =>
        `$property phải là object tối đa ${TABLE_PREFERENCE_LIMITS.recordKeysMax} khóa, giá trị ${typeName}`,
    },
  });
}
