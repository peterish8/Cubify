/**
 * Pure decode/validation for WCA rank-list shards.
 * Shared by the main thread and the decode Web Worker — MUST NOT import any
 * worker-spawning or DOM code, so it can run in either context.
 */
import type { RankType } from "@/lib/wca-rank-totals"

export interface RankListSource {
  name: string
  exportDate: string
  exportFormatVersion: string
  archiveUrl: string
  url: string
  attribution: string
}

export interface RankListDocument {
  schemaVersion: 1
  eventId: string
  rankType: RankType
  encoding: "delta-i32+u16+u8-b64"
  source: RankListSource
  count: number
  countries: string[]
  continents: string[]
  bestsB64: string
  countryIdxB64: string
  continentIdxB64: string
}

/** Decoded in-memory shard ready for binary search. */
export interface RankListIndex {
  eventId: string
  rankType: RankType
  source: RankListSource
  count: number
  bests: Int32Array
  /** country iso2 per row */
  countryIso2: string[]
  /** continent id per row */
  continentId: string[]
  /** Lazy NR/CR filtered caches keyed by region code */
  _scopeCache?: Map<string, Int32Array>
}

const SOURCE_NAME = "World Cube Association Results Export"
const SOURCE_URL = "https://www.worldcubeassociation.org/export/results"
const ENCODING = "delta-i32+u16+u8-b64"

export function isPlainPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

export function isPlainNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function base64ToBytes(b64: string): Uint8Array {
  // Prefer browser-native decoder so the client bundle never depends on Node Buffer.
  if (typeof globalThis.atob === "function") {
    const bin = globalThis.atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  // Node / tsx tests only
  const NodeBuffer = (globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }).Buffer
  if (NodeBuffer) return Uint8Array.from(NodeBuffer.from(b64, "base64"))
  throw new Error("No base64 decoder available")
}

function unpackI32Deltas(b64: string, count: number): Int32Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected bests payload")
    return new Int32Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count * 4) throw new Error("bests payload length mismatch")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const bests = new Int32Array(count)
  let acc = 0
  for (let i = 0; i < count; i++) {
    acc += view.getInt32(i * 4, true)
    bests[i] = acc
  }
  return bests
}

function unpackU16(b64: string, count: number): Uint16Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected country payload")
    return new Uint16Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count * 2) throw new Error("country payload length mismatch")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Uint16Array(count)
  for (let i = 0; i < count; i++) out[i] = view.getUint16(i * 2, true)
  return out
}

function unpackU8(b64: string, count: number): Uint8Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected continent payload")
    return new Uint8Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count) throw new Error("continent payload length mismatch")
  return bytes
}

export function assertRankListDocument(value: unknown): asserts value is RankListDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid rank list document")
  }
  const doc = value as Partial<RankListDocument>
  if (doc.schemaVersion !== 1) throw new Error("Unsupported rank list schema")
  if (doc.encoding !== ENCODING) throw new Error("Unsupported rank list encoding")
  if (typeof doc.eventId !== "string" || !doc.eventId) throw new Error("Invalid event id")
  if (doc.rankType !== "single" && doc.rankType !== "average") throw new Error("Invalid rank type")
  if (!isPlainNonNegInt(doc.count)) throw new Error("Invalid count")
  const source = doc.source
  if (
    !source ||
    source.name !== SOURCE_NAME ||
    source.url !== SOURCE_URL ||
    typeof source.exportDate !== "string" ||
    !source.exportDate ||
    typeof source.exportFormatVersion !== "string" ||
    !source.exportFormatVersion.startsWith("2.") ||
    typeof source.archiveUrl !== "string" ||
    !source.archiveUrl.startsWith("https://") ||
    typeof source.attribution !== "string" ||
    !source.attribution
  ) {
    throw new Error("Rank list source metadata is invalid")
  }
  if (!Array.isArray(doc.countries) || !Array.isArray(doc.continents)) {
    throw new Error("Missing region tables")
  }
  if (doc.count > 0 && (doc.countries.length === 0 || doc.continents.length === 0)) {
    throw new Error("Empty region tables")
  }
  for (const iso2 of doc.countries) {
    if (typeof iso2 !== "string" || !/^[A-Z]{2}$/.test(iso2)) throw new Error("Invalid country code")
  }
  for (const continentId of doc.continents) {
    if (typeof continentId !== "string" || !continentId.startsWith("_")) {
      throw new Error("Invalid continent id")
    }
  }
  if (
    typeof doc.bestsB64 !== "string" ||
    typeof doc.countryIdxB64 !== "string" ||
    typeof doc.continentIdxB64 !== "string"
  ) {
    throw new Error("Missing packed payloads")
  }

  // Structural decode check (also validates sorted bests)
  const bests = unpackI32Deltas(doc.bestsB64, doc.count)
  const countryIdx = unpackU16(doc.countryIdxB64, doc.count)
  const continentIdx = unpackU8(doc.continentIdxB64, doc.count)
  let previous = 0
  for (let i = 0; i < doc.count; i++) {
    const best = bests[i]
    if (!isPlainPositiveInt(best)) throw new Error("Non-positive best in list")
    if (i > 0 && best < previous) throw new Error("Bests must be non-decreasing")
    previous = best
    if (countryIdx[i] >= doc.countries.length) throw new Error("Country index out of range")
    if (continentIdx[i] >= doc.continents.length) throw new Error("Continent index out of range")
  }
}

export function decodeRankListDocument(doc: RankListDocument): RankListIndex {
  assertRankListDocument(doc)
  const bests = unpackI32Deltas(doc.bestsB64, doc.count)
  const countryIdx = unpackU16(doc.countryIdxB64, doc.count)
  const continentIdx = unpackU8(doc.continentIdxB64, doc.count)
  const countryIso2 = new Array<string>(doc.count)
  const continentId = new Array<string>(doc.count)
  for (let i = 0; i < doc.count; i++) {
    countryIso2[i] = doc.countries[countryIdx[i]]
    continentId[i] = doc.continents[continentIdx[i]]
  }
  return {
    eventId: doc.eventId,
    rankType: doc.rankType,
    source: doc.source,
    count: doc.count,
    bests,
    countryIso2,
    continentId,
  }
}
