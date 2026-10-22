/** Keep media concurrency independent of the small production DB pool. */
export function createSerialWriter(
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await operation();
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (attempt >= 4 || !["P2024", "P1001", "P1002", "P1017"].includes(code ?? "")) throw error;
          console.warn(`DB write retry ${attempt + 1}/4 (${code})`);
          await pause(Math.min(1000 * 2 ** attempt, 8000));
        }
      }
    });
    tail = result.catch(() => undefined);
    return result;
  };
}
