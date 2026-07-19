/**
 * Dedicated Web Worker: decodes a rank-list shard off the main thread so the
 * Goal page stays responsive while a multi-MB shard is unpacked.
 * Imports ONLY the pure codec (no DOM / no worker-spawn code).
 */
import { decodeRankListDocument, type RankListDocument } from "./wca-rank-list-codec"

// `any`-cast the worker global to sidestep dom-vs-webworker lib type conflicts
// (tsconfig uses the dom lib). Runtime behavior is unaffected.
const ctx = self as any

ctx.onmessage = (event: MessageEvent<{ id: number; doc: RankListDocument }>) => {
  const { id, doc } = event.data
  try {
    const index = decodeRankListDocument(doc)
    // Transfer the Int32Array buffer (zero-copy) back to the main thread.
    ctx.postMessage({ id, ok: true, index }, [index.bests.buffer])
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "Rank list decode failed",
    })
  }
}

export {}
