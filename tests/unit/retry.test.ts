import { describe, expect, it, vi } from 'vitest';
import { isModelBusy, retryIfBusy } from '../../src/lib/retry.js';

const busy = Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), {
  status: 503,
});
const quota = Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), {
  status: 429,
});

describe('isModelBusy', () => {
  it('recognises an overloaded model but not a used-up quota', () => {
    expect(isModelBusy(busy)).toBe(true);
    expect(isModelBusy(new Error('The model is overloaded. Please try again later.'))).toBe(true);
    expect(isModelBusy(quota)).toBe(false);
    expect(isModelBusy(new Error('Invalid API key'))).toBe(false);
  });
});

describe('retryIfBusy', () => {
  const quiet = { delayMs: 0 };

  it('tries once more when the model is busy', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValueOnce(busy).mockResolvedValueOnce('answer');

    expect(await retryIfBusy(fn, 'Answer', quiet)).toBe('answer');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.mocked(console.warn).mockRestore();
  });

  it('gives up after the second failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValue(busy);

    await expect(retryIfBusy(fn, 'Answer', quiet)).rejects.toBe(busy);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.mocked(console.warn).mockRestore();
  });

  it("doesn't retry other errors", async () => {
    const fn = vi.fn().mockRejectedValue(quota);

    await expect(retryIfBusy(fn, 'Answer', quiet)).rejects.toBe(quota);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("doesn't retry once the caller has given up", async () => {
    const fn = vi.fn().mockRejectedValue(busy);

    await expect(
      retryIfBusy(fn, 'Answer', { ...quiet, signal: AbortSignal.abort() })
    ).rejects.toBe(busy);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
