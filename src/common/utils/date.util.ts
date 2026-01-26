/**
 * Parse expiry string (e.g., "30d", "3m", "3min", "1h", "1hour", "7days") to milliseconds.
 * Supports both short (s, m, h, d) and long (second, minute, hour, day) formats.
 * defaults to 30 days if format is invalid.
 *
 * @param expiry The expiry string to parse
 * @returns The duration in milliseconds
 */
export function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(
    /^(\d+)(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours|d|day|days)$/i,
  );
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000; // Default 30 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('s')) {
    return value * 1000;
  } else if (unit.startsWith('m')) {
    return value * 60 * 1000;
  } else if (unit.startsWith('h')) {
    return value * 60 * 60 * 1000;
  } else if (unit.startsWith('d')) {
    return value * 24 * 60 * 60 * 1000;
  }

  return 30 * 24 * 60 * 60 * 1000;
}
