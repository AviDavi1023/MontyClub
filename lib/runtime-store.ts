import fs from 'fs'
import path from 'path'

// Simple runtime store that prefers filesystem but falls back to an in-memory map
// when the environment is read-only (for example, Vercel serverless environments).

const memoryStore = new Map<string, any>()
let readOnlyDetected = false

function dataFilePath(name: string) {
  return path.join(process.cwd(), 'data', `${name}.json`)
}

export async function readData(name: string, fallback: any) {
  const file = dataFilePath(name)
  try {
    if (fs.existsSync(file)) {
      const raw = await fs.promises.readFile(file, 'utf-8')
      return JSON.parse(raw || 'null')
    }
  } catch (err: any) {
    // If filesystem is read-only or another error occurred, fall back to memory
    console.warn('readData: filesystem read failed, falling back to memory store:', err?.code || err)
    readOnlyDetected = true
  }

  if (memoryStore.has(name)) return memoryStore.get(name)
  return fallback
}

export async function writeData(name: string, value: any) {
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

export function isReadOnlyFallback() {
  return readOnlyDetected
}

export function readMemory(name: string) {
  return memoryStore.get(name)
}
