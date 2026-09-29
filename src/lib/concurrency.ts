// Run an async mapper over items with a hard ceiling on how many run at once.
//
// The core API caps DB connections at 2 per container, so unbounded Promise.all
// fan-outs queue behind those connections and trip the backend's 10s handler
// deadline (504 timeout). Keeping in-flight work small avoids that herd while
// still being much faster than a sequential loop.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
