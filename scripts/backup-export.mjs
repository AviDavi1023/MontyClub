#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

async function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName)
  let raw
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx <= 0) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

await loadEnvFile('.env.local')
await loadEnvFile('.env')

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const runtimeBucket = process.env.SUPABASE_BUCKET

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[backup] Missing required env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const client = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PAGE_SIZE = 1000

function pad(num) {
  return String(num).padStart(2, '0')
}

function timestampForFile(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('')
}

async function fetchTableRows(tableName) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .range(from, to)

    if (error) {
      throw new Error(`Failed table read for ${tableName}: ${error.message}`)
    }

    if (!data || data.length === 0) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function readJsonFileFromBucket(bucket, filePath) {
  const { data, error } = await client.storage.from(bucket).download(filePath)
  if (error || !data) {
    return { found: false, error: error?.message || 'not found' }
  }

  const text = await data.text()
  try {
    return { found: true, json: JSON.parse(text) }
  } catch (parseError) {
    return { found: true, raw: text, error: `JSON parse error: ${String(parseError)}` }
  }
}

async function buildBackupPayload() {
  const tables = {}
  const tableErrors = {}

  const tableNames = [
    'registration_collections',
    'club_registrations',
    'clubs',
    'admin_users',
  ]

  for (const tableName of tableNames) {
    try {
      tables[tableName] = await fetchTableRows(tableName)
    } catch (error) {
      tableErrors[tableName] = String(error)
      tables[tableName] = []
    }
  }

  const bucketsToCheck = Array.from(new Set(['club-data', runtimeBucket].filter(Boolean)))
  const storagePaths = [
    'settings/clubs-snapshot.json',
    'settings/registration-settings.json',
    'settings/registration-collections.json',
    'announcements.json',
    'updates.json',
    'settings.json',
    'renewal-settings.json',
    'admin-users.json',
  ]

  const files = {}
  for (const bucket of bucketsToCheck) {
    files[bucket] = {}
    for (const filePath of storagePaths) {
      files[bucket][filePath] = await readJsonFileFromBucket(bucket, filePath)
    }
  }

  const counts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])
  )

  return {
    metadata: {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      source: 'MontyClub backup-export',
      supabaseUrl,
      bucketsChecked: bucketsToCheck,
      nodeVersion: process.version,
    },
    counts,
    tableErrors,
    tables,
    files,
  }
}

async function main() {
  const outputDir = path.join(process.cwd(), 'backups')
  await fs.mkdir(outputDir, { recursive: true })

  const payload = await buildBackupPayload()
  const stamp = timestampForFile()
  const fileName = `montyclub-backup-${stamp}.json`
  const filePath = path.join(outputDir, fileName)
  const json = JSON.stringify(payload, null, 2)

  await fs.writeFile(filePath, json, 'utf8')

  const sha256 = crypto.createHash('sha256').update(json).digest('hex')
  await fs.writeFile(`${filePath}.sha256`, `${sha256}  ${fileName}\n`, 'utf8')

  console.log('[backup] Created backup successfully')
  console.log(`[backup] File: ${filePath}`)
  console.log(`[backup] SHA256: ${sha256}`)
  console.log(`[backup] Counts: ${JSON.stringify(payload.counts)}`)

  const tableErrorKeys = Object.keys(payload.tableErrors || {})
  if (tableErrorKeys.length > 0) {
    console.warn(`[backup] Table read warnings: ${tableErrorKeys.join(', ')}`)
  }
}

main().catch((error) => {
  console.error('[backup] Failed:', error)
  process.exit(1)
})
