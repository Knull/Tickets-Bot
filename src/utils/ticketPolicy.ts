export const ACTIVE_TICKET_STATUSES = ['open', 'reopened'] as const;
export const AUTO_CLOSEABLE_TICKET_STATUSES = ['open', 'reopened'] as const;
export const MAX_OPEN_TICKETS_PER_USER = 2;

export const INITIAL_INACTIVITY_MS = 15 * 60 * 1_000;
export const ACTIVE_INACTIVITY_MS = 24 * 60 * 60 * 1_000;

const DURATION_UNITS_MS = {
  s: 1_000,
  m: 60 * 1_000,
  h: 60 * 60 * 1_000,
  d: 24 * 60 * 60 * 1_000,
  w: 7 * 24 * 60 * 60 * 1_000,
} as const;

export function parseDuration(value: string): number | null {
  const match = /^(\d+)([smhdw])$/i.exec(value.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() as keyof typeof DURATION_UNITS_MS | undefined;
  if (!unit || !Number.isSafeInteger(amount) || amount <= 0) return null;

  const duration = amount * DURATION_UNITS_MS[unit];
  return Number.isSafeInteger(duration) ? duration : null;
}

export function getAutoCloseCutoffs(now: Date): { initial: Date; active: Date } {
  return {
    initial: new Date(now.getTime() - INITIAL_INACTIVITY_MS),
    active: new Date(now.getTime() - ACTIVE_INACTIVITY_MS),
  };
}
