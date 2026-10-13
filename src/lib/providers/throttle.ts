export type Sleep = (milliseconds: number) => Promise<void>;

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

function retryable(error: unknown): boolean {
  return error instanceof Error && "status" in error && (error.status === 429 || error.status === 503);
}

/** Retry only rate-limit and temporary-unavailable errors, with exponential backoff. */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; sleepFn?: Sleep } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const wait = options.sleepFn ?? sleep;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !retryable(error)) throw error;
      await wait(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

/** Create a per-provider throttle; callers share one instance across that provider's calls. */
export function createThrottle(minIntervalMs = 2_200, sleepFn: Sleep = sleep): (providerId: string) => Promise<void> {
  const lastCallAt = new Map<string, number>();
  const queued = new Map<string, Promise<void>>();
  return (providerId) => {
    const previousCall = queued.get(providerId) ?? Promise.resolve();
    const nextCall = previousCall.catch(() => undefined).then(async () => {
      const previousAt = lastCallAt.get(providerId);
      if (previousAt !== undefined) {
        const remaining = minIntervalMs - (Date.now() - previousAt);
        if (remaining > 0) await sleepFn(remaining);
      }
      lastCallAt.set(providerId, Date.now());
    });
    queued.set(providerId, nextCall);
    return nextCall;
  };
}
