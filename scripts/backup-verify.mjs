#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

async function getLatestBackupFile(backupsDir) {
  const entries = await fs.readdir(backupsDir)
  const candidates = entries
    .filter((name) => name.startsWith('montyclub-backup-') && name.endsWith('.json'))
    .sort()

  if (candidates.length === 0) {
    throw new Error(`No backup files found in ${backupsDir}`)
  }

  return path.join(backupsDir, candidates[candidates.length - 1])
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const argPath = process.argv[2]
  const backupsDir = path.join(process.cwd(), 'backups')
  const filePath = argPath
    ? path.resolve(process.cwd(), argPath)
    : await getLatestBackupFile(backupsDir)

  const raw = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(raw)

  assertCondition(data && typeof data === 'object', 'Backup is not a JSON object')
  assertCondition(data.metadata && typeof data.metadata === 'object', 'Missing metadata')
  assertCondition(data.tables && typeof data.tables === 'object', 'Missing tables object')
  assertCondition(data.counts && typeof data.counts === 'object', 'Missing counts object')

  const requiredTables = [
    'registration_collections',
    'club_registrations',
    'clubs',
    'admin_users',
  ]

  for (const tableName of requiredTables) {
    assertCondition(Array.isArray(data.tables[tableName]), `Table ${tableName} is missing or not an array`)
  }

  console.log(`[backup:verify] File: ${filePath}`)
  console.log(`[backup:verify] Created at: ${data.metadata.createdAt || 'unknown'}`)
  console.log('[backup:verify] Row counts:')

  for (const tableName of requiredTables) {
    const rowCount = data.tables[tableName].length
    console.log(`  - ${tableName}: ${rowCount}`)
  }

  if (data.tableErrors && Object.keys(data.tableErrors).length > 0) {
    console.warn('[backup:verify] Table warnings found:')
    for (const [tableName, error] of Object.entries(data.tableErrors)) {
      console.warn(`  - ${tableName}: ${error}`)
    }
  }

  console.log('[backup:verify] Backup structure looks valid')
}

main().catch((error) => {
  console.error('[backup:verify] Failed:', error.message)
  process.exit(1)
})
