import type { DurableCheckpointValue } from './durable-execution';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const codePattern = /^[a-z][a-z0-9_]{0,63}$/;
const maximumJsonDepth = 50;

export function durableIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw new Error(
      `${label} must be a 1-128 character identifier using letters, numbers, '.', '_', ':', or '-'.`,
    );
  }
  return value;
}

export function durableCode(value: unknown, label: string): string {
  if (typeof value !== 'string' || !codePattern.test(value)) {
    throw new Error(
      `${label} must be a lowercase snake-case identifier up to 64 characters.`,
    );
  }
  return value;
}

export function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

export function validDate(value: unknown, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} must be a valid Date.`);
  }
  return value;
}

export function positiveDuration(value: unknown, label: string): number {
  const duration = positiveInteger(value, label);
  if (duration > 86_400_000) {
    throw new Error(`${label} must not exceed 24 hours.`);
  }
  return duration;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJson(
  value: unknown,
  label: string,
  seen: Set<object>,
  depth: number,
): asserts value is DurableCheckpointValue {
  if (depth > maximumJsonDepth) {
    throw new Error(`${label} exceeds the maximum JSON depth.`);
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} contains a non-finite number.`);
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new Error(`${label} must contain JSON-compatible values only.`);
  }
  if (seen.has(value)) {
    throw new Error(`${label} must not contain cyclic references.`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const nested of value) validateJson(nested, label, seen, depth + 1);
      return;
    }
    if (!isPlainObject(value)) {
      throw new Error(`${label} must contain plain JSON objects only.`);
    }
    for (const nested of Object.values(value)) {
      validateJson(nested, label, seen, depth + 1);
    }
  } finally {
    seen.delete(value);
  }
}

export function durableCheckpointState(
  value: unknown,
  label = 'checkpoint.state',
): DurableCheckpointValue {
  validateJson(value, label, new Set<object>(), 0);
  return value;
}

export function cloneCheckpointValue(
  value: DurableCheckpointValue,
): DurableCheckpointValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(cloneCheckpointValue);
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      cloneCheckpointValue(nested),
    ]),
  );
}

export function canonicalCheckpointValue(
  value: DurableCheckpointValue,
): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalCheckpointValue).join(',')}]`;
  }
  const objectValue = value as {
    readonly [key: string]: DurableCheckpointValue;
  };
  return `{${Object.keys(objectValue)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalCheckpointValue(objectValue[key]!)}`,
    )
    .join(',')}}`;
}
