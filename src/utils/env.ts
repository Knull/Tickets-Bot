import 'dotenv/config';

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function env(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function snowflakeEnv(name: string, fallback: string): string {
  const value = env(name, fallback);
  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} must be a valid Discord snowflake.`);
  }
  return value;
}

export function csvEnv(name: string, fallback: readonly string[]): string[] {
  const raw = process.env[name];
  if (!raw) return [...fallback];

  const values = raw.split(',').map(value => value.trim()).filter(Boolean);
  if (values.some(value => !/^\d{17,20}$/.test(value))) {
    throw new Error(`${name} must contain comma-separated Discord snowflakes.`);
  }
  return [...new Set(values)];
}
