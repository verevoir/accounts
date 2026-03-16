import type { StorageAdapter } from '../src/types.js';

/** Minimal in-memory StorageAdapter for testing. No external dependency. */
export function createMemoryStorage(): StorageAdapter {
  let nextId = 1;
  const docs = new Map<
    string,
    { id: string; blockType: string; data: Record<string, unknown> }
  >();

  return {
    async create(blockType, data) {
      const id = `${blockType}-${nextId++}`;
      const doc = { id, blockType, data: { ...data } };
      docs.set(id, doc);
      return { id, data: { ...data } };
    },

    async list(blockType, options) {
      const results: { id: string; data: Record<string, unknown> }[] = [];
      for (const doc of docs.values()) {
        if (doc.blockType !== blockType) continue;
        if (options?.where) {
          const match = Object.entries(options.where).every(([k, v]) =>
            k === 'id' ? doc.id === v : doc.data[k] === v,
          );
          if (!match) continue;
        }
        results.push({ id: doc.id, data: { ...doc.data } });
      }
      return results;
    },

    async update(id, data) {
      const existing = docs.get(id);
      if (!existing) throw new Error(`Document ${id} not found`);
      existing.data = { ...data };
      return { id, data: { ...data } };
    },

    async delete(id) {
      docs.delete(id);
    },
  };
}
