import { db, type DexieContentChunk } from "./db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { DexieContentChunk as ContentChunk };

// ── Text chunking ─────────────────────────────────────────────────────────────

const CHUNK_CHARS = 2000; // ~500 tokens at 4 chars/token

export function chunkText(
  text: string,
  courseId: number,
  sourceType: string,
  sourceTitle: string
): DexieContentChunk[] {
  const chunks: DexieContentChunk[] = [];
  // Clean HTML if present
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  for (let i = 0; i * CHUNK_CHARS < clean.length; i++) {
    const slice = clean.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
    if (!slice.trim()) continue;
    chunks.push({
      chunkId: `${courseId}-${sourceTitle.replace(/\s+/g, "_")}-${i}`,
      courseId,
      chunkText: slice,
      metadata: { sourceType, sourceTitle, chunkIndex: i },
    });
  }
  return chunks;
}

// ── Index management ──────────────────────────────────────────────────────────

/**
 * Store chunks in Dexie and signal the web worker to rebuild its in-memory index.
 */
export async function indexCourseContent(
  courseId: number,
  chunks: DexieContentChunk[]
): Promise<void> {
  if (chunks.length === 0) return;
  await db.contentChunks.bulkPut(chunks);
  // Notify the worker (fire-and-forget; worker rebuilds index on next SEARCH)
  try {
    const worker = new Worker(
      new URL("../workers/flexSearch.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.postMessage({ type: "INDEX", courseId });
    worker.onmessage = () => worker.terminate();
  } catch {
    // Worker failures don't block the main thread
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Search course content using FlexSearch in a web worker.
 * Falls back to a simple substring scan if the worker fails.
 */
export function searchContent(
  courseId: number,
  query: string,
  topK = 5
): Promise<DexieContentChunk[]> {
  return new Promise((resolve) => {
    try {
      const worker = new Worker(
        new URL("../workers/flexSearch.worker.ts", import.meta.url),
        { type: "module" }
      );

      const timeout = setTimeout(async () => {
        worker.terminate();
        // Fallback: simple Dexie substring scan
        const all = await db.contentChunks
          .where("courseId")
          .equals(courseId)
          .toArray();
        const q = query.toLowerCase();
        resolve(
          all
            .filter((c) => c.chunkText.toLowerCase().includes(q))
            .slice(0, topK)
        );
      }, 5000);

      worker.postMessage({ type: "SEARCH", courseId, query, topK });
      worker.onmessage = async (e: MessageEvent<{ chunkIds: string[] }>) => {
        clearTimeout(timeout);
        worker.terminate();
        const { chunkIds } = e.data;
        const chunks = await db.contentChunks
          .where("chunkId")
          .anyOf(chunkIds)
          .toArray();
        resolve(chunks);
      };

      worker.onerror = async () => {
        clearTimeout(timeout);
        worker.terminate();
        // Fallback
        const all = await db.contentChunks
          .where("courseId")
          .equals(courseId)
          .toArray();
        const q = query.toLowerCase();
        resolve(
          all
            .filter((c) => c.chunkText.toLowerCase().includes(q))
            .slice(0, topK)
        );
      };
    } catch {
      resolve([]);
    }
  });
}
