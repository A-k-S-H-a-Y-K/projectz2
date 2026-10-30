// Gemini's free tier sometimes answers 503 ("the model is overloaded") for a moment. Those
// calls are tried once more after a short pause. Other errors, such as a used-up quota (429)
// or a bad request, won't fix themselves that quickly, so they're thrown straight away.
export const RETRY_DELAY_MS = 1500;

export function isModelBusy(error: unknown): boolean {
  if ((error as { status?: unknown })?.status === 503) return true;
  return /\b503\b|UNAVAILABLE|overloaded/i.test(String(error));
}

export async function retryIfBusy<T>(
  fn: () => Promise<T>,
  label: string,
  { delayMs = RETRY_DELAY_MS, signal }: { delayMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Don't retry once the caller has given up (timeout or the client disconnected)
    if (!isModelBusy(error) || signal?.aborted) throw error;
    console.warn(`${label}: Gemini is busy, trying once more in ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (signal?.aborted) throw error;
    return fn();
  }
}
