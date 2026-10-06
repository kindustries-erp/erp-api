/**
 * Universal TOON (Token-Oriented Object Notation) Serializer
 * Converts ANY arbitrary JSON data (multi-level, nested objects, arrays, primitives)
 * into compact, token-efficient TOON format for LLM prompts.
 *
 * Saves ~45%-55% input tokens compared to raw JSON.
 */

export interface ToonSerializeOptions {
  /**
   * Indentation spaces per level (default: 2)
   */
  indentSize?: number;

  /**
   * Delimiter between tabular row values (default: ' | ')
   */
  delimiter?: string;

  /**
   * Skip null and undefined object keys to reduce token waste (default: true)
   */
  skipNulls?: boolean;
}

/**
 * Universal JSON-to-TOON converter
 */
export function jsonToToon(
  data: unknown,
  indent = 0,
  options: ToonSerializeOptions = {
    indentSize: 2,
    delimiter: ' | ',
    skipNulls: true,
  },
): string {
  const indentSize = options.indentSize ?? 2;
  const delimiter = options.delimiter ?? ' | ';
  const skipNulls = options.skipNulls ?? true;

  const pad = ' '.repeat(indent);
  const nextPad = ' '.repeat(indent + indentSize);

  if (data === null || data === undefined) {
    return 'null';
  }

  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return `${data}`;
  }
  if (typeof data !== 'object') {
    return '';
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  // 1. Handle Array
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';

    // Case 1A: Array of primitives (numbers, strings, booleans, dates) -> single line: [a, b, c]
    const isAllPrimitives = data.every(
      (item) => item === null || item === undefined || typeof item !== 'object',
    );
    if (isAllPrimitives) {
      const cleanItems = data.map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v.replace(/[\n\r]/g, ' ').trim();
        if (typeof v === 'number' || typeof v === 'boolean') return `${v}`;
        return '';
      });
      return `[${cleanItems.join(', ')}]`;
    }

    // Case 1B: Array of uniform shallow objects -> Format as Tabular TOON:
    // [col1,col2,col3]: \n - val1 | val2 | val3
    const isAllObjects = data.every(
      (item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );

    if (isAllObjects) {
      const keysSet = new Set<string>();
      data.forEach((obj) =>
        Object.keys(obj as object).forEach((k) => keysSet.add(k)),
      );
      const keys = Array.from(keysSet);

      const isTabular = data.every((obj) =>
        keys.every((k) => {
          const val = (obj as Record<string, unknown>)[k];
          return val === null || val === undefined || typeof val !== 'object';
        }),
      );

      if (isTabular && keys.length > 0) {
        const lines: string[] = [];
        lines.push(`[${keys.join(',')}]`);
        for (const row of data) {
          const rowValues = keys.map((k) => {
            const val = (row as Record<string, unknown>)[k];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') {
              return val.replace(/[\n\r|]/g, ' ').trim();
            }
            if (typeof val === 'number' || typeof val === 'boolean') {
              return `${val}`;
            }
            return '';
          });
          lines.push(`${nextPad}- ${rowValues.join(delimiter)}`);
        }
        return lines.join('\n');
      }
    }

    // Case 1C: Heterogeneous or Deeply Nested Array -> Recurse item by item
    return data
      .map((item) => {
        const serialized = jsonToToon(item, indent + indentSize, options);
        return `${pad}- ${serialized.trimStart()}`;
      })
      .join('\n');
  }

  // 2. Handle Object (Nested / Multi-level)
  const lines: string[] = [];
  const entries = Object.entries(data as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (skipNulls && (value === null || value === undefined)) {
      continue;
    }

    if (value === null || value === undefined) {
      lines.push(`${pad}${key}: null`);
    } else if (typeof value !== 'object') {
      let cleanVal = '';
      if (typeof value === 'string') {
        cleanVal = value.replace(/[\n\r]/g, ' ').trim();
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        cleanVal = `${value}`;
      }
      lines.push(`${pad}${key}: ${cleanVal}`);
    } else if (value instanceof Date) {
      lines.push(`${pad}${key}: ${value.toISOString()}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else {
        const serializedArray = jsonToToon(value, indent, options);
        if (serializedArray.startsWith('[') && serializedArray.includes('\n')) {
          // Tabular format with schema header: key[col1,col2]:
          const [header, ...rows] = serializedArray.split('\n');
          lines.push(`${pad}${key}${header}:`);
          if (rows.length > 0) {
            lines.push(rows.join('\n'));
          }
        } else if (
          serializedArray.startsWith('[') &&
          !serializedArray.includes('\n')
        ) {
          // Primitive array on single line: tags: [VIP, TAX]
          lines.push(`${pad}${key}: ${serializedArray}`);
        } else {
          lines.push(`${pad}${key}:`);
          lines.push(serializedArray);
        }
      }
    } else {
      // Nested child object -> Recurse with deeper indentation
      lines.push(`${pad}${key}:`);
      lines.push(jsonToToon(value, indent + indentSize, options));
    }
  }

  return lines.join('\n');
}
