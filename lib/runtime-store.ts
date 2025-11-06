import fs from 'fs'
import path from 'path'

// Runtime store with optional Vercel KV backing. If KV is configured via
// VERCEL_KV_URL and VERCEL_KV_TOKEN, use it for durable storage. Otherwise
// prefer filesystem and fall back to in-memory when filesystem is read-only.

let kvClient: any = null
try {
  if (process.env.VERCEL_KV_URL && process.env.VERCEL_KV_TOKEN) {
    // lazy require to avoid hard dependency issues in environments without package
    // installed during development; package should be present in production.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@vercel/kv')
    kvClient = createClient({ url: process.env.VERCEL_KV_URL, token: process.env.VERCEL_KV_TOKEN })
  }
} catch (e: any) {
  console.warn('Vercel KV client not available:', (e && (e as any).message) || e)
  kvClient = null
}

const memoryStore = new Map<string, any>()
let readOnlyDetected = false

function dataFilePath(name: string) {
  return path.join(process.cwd(), 'data', `${name}.json`)
}

export async function readData(name: string, fallback: any) {
  // Try KV first
  try {
    if (kvClient) {
      const v = await kvClient.get(name)
      if (typeof v !== 'undefined' && v !== null) return v
    }
  } catch (e: any) {
    console.warn('KV read failed:', (e && (e as any).message) || e)
  }

  // Then filesystem
  const file = dataFilePath(name)
  try {
    if (fs.existsSync(file)) {
      const raw = await fs.promises.readFile(file, 'utf-8')
      return JSON.parse(raw || 'null')
    }
  } catch (err: any) {
    console.warn('readData: filesystem read failed, falling back to memory store:', err?.code || err)
    readOnlyDetected = true
  }

  if (memoryStore.has(name)) return memoryStore.get(name)
  return fallback
}

export async function writeData(name: string, value: any) {
  // Try KV first
  try {
    if (kvClient) {
      await kvClient.set(name, value)
      return { ok: true, persisted: 'kv' }
    }
  } catch (e: any) {
    console.warn('KV write failed, falling back:', (e && (e as any).message) || e)
  }

  const file = dataFilePath(name)
  try {
    // ensure directory
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    await fs.promises.writeFile(file, JSON.stringify(value, null, 2), 'utf-8')
    return { ok: true, persisted: 'fs' }
  } catch (err: any) {
    console.warn('writeData: filesystem write failed, switching to in-memory store:', err?.code || err)
    readOnlyDetected = true
    memoryStore.set(name, value)
    return { ok: true, persisted: 'memory' }
  }
}

export async function readFile(name: string): Promise<Buffer | null> {
  // KV stores files as base64 strings under the key name
  try {
    if (kvClient) {
      const b64 = await kvClient.get(name)
      if (typeof b64 === 'string') return Buffer.from(b64, 'base64')
    }
  } catch (e: any) {
    console.warn('KV readFile failed:', (e && (e as any).message) || e)
  }

  const filePath = path.join(process.cwd(), name)
  try {
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath)
    }
  } catch (e: any) {
    console.warn('readFile fs read failed:', e?.message || e)
    readOnlyDetected = true
  }
  return null
}

export async function writeFile(name: string, buffer: Buffer) {
  // Try KV first
  try {
    if (kvClient) {
      await kvClient.set(name, buffer.toString('base64'))
      return { ok: true, persisted: 'kv' }
    }
  } catch (e: any) {
    console.warn('KV writeFile failed, falling back:', (e && (e as any).message) || e)
  }

  const filePath = path.join(process.cwd(), name)
  try {
    await fs.promises.writeFile(filePath, buffer)
    return { ok: true, persisted: 'fs' }
  } catch (e: any) {
    console.warn('writeFile fs write failed, storing in-memory:', e?.message || e)
    readOnlyDetected = true
    memoryStore.set(name, buffer)
    return { ok: true, persisted: 'memory' }
  }
}

export function isReadOnlyFallback() {
  return readOnlyDetected
}

export function readMemory(name: string) {
  return memoryStore.get(name)
}
