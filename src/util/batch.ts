export function* generateBatch(items, batchSize = 100) {
  while (items.length > 0) {
    yield items.splice(0, batchSize);
  }
}
