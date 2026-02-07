// Unit Converter

export interface ConversionResult {
  value?: number;
  error?: string;
}

const LENGTH_FACTORS: Record<string, number> = {
  m: 1, meter: 1, meters: 1, km: 1000, kilometer: 1000, kilometers: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01, mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  mi: 1609.344, mile: 1609.344, miles: 1609.344, yd: 0.9144, yard: 0.9144, yards: 0.9144,
  ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254,
};

const WEIGHT_FACTORS: Record<string, number> = {
  kg: 1, kilogram: 1, kilograms: 1, g: 0.001, gram: 0.001, grams: 0.001,
  mg: 0.000001, milligram: 0.000001, lb: 0.453592, pound: 0.453592, pounds: 0.453592,
  oz: 0.0283495, ounce: 0.0283495, ounces: 0.0283495, ton: 907.185, tons: 907.185,
};

const VOLUME_FACTORS: Record<string, number> = {
  l: 1, liter: 1, liters: 1, ml: 0.001, milliliter: 0.001, milliliters: 0.001,
  gal: 3.78541, gallon: 3.78541, gallons: 3.78541, qt: 0.946353, quart: 0.946353, quarts: 0.946353,
  pt: 0.473176, pint: 0.473176, pints: 0.473176, cup: 0.236588, cups: 0.236588,
};

const AREA_FACTORS: Record<string, number> = {
  sqm: 1, 'm2': 1, 'sq m': 1, 'square meter': 1, sqkm: 1e6, 'km2': 1e6, 'sq km': 1e6,
  sqft: 0.092903, 'ft2': 0.092903, 'sq ft': 0.092903, 'square foot': 0.092903, 'square feet': 0.092903,
  sqmi: 2.59e6, 'mi2': 2.59e6, 'sq mi': 2.59e6, acre: 4046.86, acres: 4046.86, hectare: 10000, hectares: 10000, ha: 10000,
};

const SPEED_FACTORS: Record<string, number> = {
  'ms': 1, 'm/s': 1, 'kmh': 0.277778, 'km/h': 0.277778, 'kph': 0.277778,
  'mph': 0.44704, 'miles per hour': 0.44704, 'knot': 0.514444, 'knots': 0.514444,
};

const TEMP_UNITS = ['celsius', 'c', 'fahrenheit', 'f', 'kelvin', 'k'];

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

function findCategory(unit: string): { category: string; factor: number } | null {
  const normalized = normalizeUnit(unit);

  if (LENGTH_FACTORS[normalized]) return { category: 'length', factor: LENGTH_FACTORS[normalized] };
  if (WEIGHT_FACTORS[normalized]) return { category: 'weight', factor: WEIGHT_FACTORS[normalized] };
  if (VOLUME_FACTORS[normalized]) return { category: 'volume', factor: VOLUME_FACTORS[normalized] };
  if (AREA_FACTORS[normalized]) return { category: 'area', factor: AREA_FACTORS[normalized] };
  if (SPEED_FACTORS[normalized]) return { category: 'speed', factor: SPEED_FACTORS[normalized] };
  if (TEMP_UNITS.includes(normalized)) return { category: 'temperature', factor: 0 };

  return null;
}

function convertTemperature(value: number, from: string, to: string): number {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);

  let celsius: number;
  if (f === 'celsius' || f === 'c') celsius = value;
  else if (f === 'fahrenheit' || f === 'f') celsius = (value - 32) * 5 / 9;
  else if (f === 'kelvin' || f === 'k') celsius = value - 273.15;
  else throw new Error(`Unknown temperature unit: ${from}`);

  if (t === 'celsius' || t === 'c') return celsius;
  if (t === 'fahrenheit' || t === 'f') return celsius * 9 / 5 + 32;
  if (t === 'kelvin' || t === 'k') return celsius + 273.15;
  throw new Error(`Unknown temperature unit: ${to}`);
}

export function convertUnit(value: number, from: string, to: string): ConversionResult {
  const fromInfo = findCategory(from);
  const toInfo = findCategory(to);

  if (!fromInfo) return { error: `Unknown unit: "${from}". Supported: length, weight, temperature, volume, area, speed.` };
  if (!toInfo) return { error: `Unknown unit: "${to}". Supported: length, weight, temperature, volume, area, speed.` };

  if (fromInfo.category !== toInfo.category) {
    return { error: `Cannot convert between ${fromInfo.category} (${from}) and ${toInfo.category} (${to}).` };
  }

  if (fromInfo.category === 'temperature') {
    try {
      const result = convertTemperature(value, from, to);
      return { value: Math.round(result * 1000) / 1000 };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  const result = value * fromInfo.factor / toInfo.factor;
  return { value: Math.round(result * 1000000) / 1000000 };
}
