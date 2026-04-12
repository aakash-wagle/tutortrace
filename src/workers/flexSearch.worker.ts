// FlexSearch Web Worker
// Maintains an in-memory index for a given courseId.
// Rebuilt from Dexie on INDEX or on first SEARCH request.

import FlexSearch from "flexsearch";
import { db } from "../lib/db";

interface IndexedDoc {
  chunkId: string;
  chunkText: string;
}

let currentCourseId: number | null = null;
let index: FlexSearch.Document<IndexedDoc> | null = null;

async function buildIndex(courseId: number): Promise<void> {
  index = new FlexSearch.Document<IndexedDoc>({
    document: { id: "chunkId", index: ["chunkText"] },
    tokenize: "forward",
    resolution: 9,
  });

  const chunks = await db.contentChunks
    .where("courseId")
    .equals(courseId)
    .toArray();

  for (const chunk of chunks) {
    index.add({ chunkId: chunk.chunkId, chunkText: chunk.chunkText });
  }

  currentCourseId = courseId;
}

self.onmessage = async (
  e: MessageEvent<
    | { type: "INDEX"; courseId: number }
    | { type: "SEARCH"; courseId: number; query: string; topK: number }
  >
) => {
  const { type, courseId } = e.data;

  if (type === "INDEX") {
    await buildIndex(courseId);
    self.postMessage({ type: "INDEX_DONE", courseId });
    return;
  }

  if (type === "SEARCH") {
    const { query, topK } = e.data as { type: "SEARCH"; courseId: number; query: string; topK: number };

    // Rebuild index if courseId changed or not yet built
    if (currentCourseId !== courseId || !index) {
      await buildIndex(courseId);
    }

    const results = index!.search(query, { limit: topK, enrich: false });
    // FlexSearch.Document returns array of { field, result[] }
    const chunkIds = (results as unknown as { result: string[] }[])[0]?.result ?? [];
    self.postMessage({ type: "SEARCH_RESULT", chunkIds: chunkIds.slice(0, topK) });
  }
};
