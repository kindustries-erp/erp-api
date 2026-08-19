import rawBatch3 from './unverified-vehicles-batch3.json';

export interface UnverifiedVehicle {
  index: number;
  release_date: string;
  vin_no: string;
  engine_no: string;
  color: string;
  model_year: number;
  model_name: string;
  serial_no: string;
}

export function normalizeVehicleCode(val?: string | null): string {
  return val?.trim().toUpperCase().replace(/[-\s]/g, '') || '';
}

export function getUnverifiedVehicleKey(
  vinNo?: string | null,
  engineNo?: string | null,
): string {
  return `${normalizeVehicleCode(vinNo)}_${normalizeVehicleCode(engineNo)}`;
}

export const UNVERIFIED_VEHICLES_BATCH3: UnverifiedVehicle[] =
  rawBatch3 as UnverifiedVehicle[];

const UNVERIFIED_VEHICLES_MAP = new Map<string, UnverifiedVehicle>();

for (const v of UNVERIFIED_VEHICLES_BATCH3) {
  const key = getUnverifiedVehicleKey(v.vin_no, v.engine_no);
  UNVERIFIED_VEHICLES_MAP.set(key, v);
}

export function findUnverifiedVehicle(
  vinNo?: string | null,
  engineNo?: string | null,
): UnverifiedVehicle | undefined {
  if (!vinNo || !engineNo) return undefined;
  const key = getUnverifiedVehicleKey(vinNo, engineNo);
  return UNVERIFIED_VEHICLES_MAP.get(key);
}

export function getAllUnverifiedVehicles(): UnverifiedVehicle[] {
  return UNVERIFIED_VEHICLES_BATCH3;
}
