#!/usr/bin/env npx tsx
/**
 * Load seeded exercises from data/exercises/ into DynamoDB.
 *
 * Usage:
 *   npx tsx scripts/seed-exercises.ts --level a1 --type fill_blank
 *   npx tsx scripts/seed-exercises.ts --level a1                    # all types for A1
 *   npx tsx scripts/seed-exercises.ts --all                         # everything
 *   npx tsx scripts/seed-exercises.ts --level a1 --dry-run          # preview only
 *   npx tsx scripts/seed-exercises.ts --level a1 --user USER123     # specific user
 *
 * Requires AWS credentials configured. Uses TABLE_NAME env var or defaults to taaltuig-main.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'

// ---------------------------------------------------------------------------
// Types — matching the seeded exercise JSON and DynamoDB entity shapes
// ---------------------------------------------------------------------------

interface SeededExercise {
  type: string
  topic_id: string
  cefr_level: string
  prompt: string
  reference_answer: string
  alternatives: string[]
  grammar_focus?: string
  blanking_strategy?: string
  source_notes?: string
}

interface DynamoItem {
  PK: string
  SK: string
  GSI2PK: string
  GSI2SK: string
  exercise_id: string
  type: string
  status: string
  source: string
  priority: string
  prompt: string
  reference_answer: string
  alternatives: string[]
  target_vocabulary: string[]
  grammar_focus?: string
  topic_id?: string
  cefr_level?: string
  generated_at: string
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const hasFlag = (name: string): boolean => args.includes(`--${name}`)

const level = getArg('level')?.toLowerCase()
const type = getArg('type')?.toLowerCase()
const dryRun = hasFlag('dry-run')
const all = hasFlag('all')
const userId = getArg('user') || 'SEED'

if (!level && !all) {
  console.error('Usage: npx tsx scripts/seed-exercises.ts --level <a1|a2|b1|b2|c1|c2> [--type <type>] [--dry-run] [--user <user_id>]')
  console.error('       npx tsx scripts/seed-exercises.ts --all [--dry-run]')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Find exercise files
// ---------------------------------------------------------------------------

const DATA_DIR = resolve('data', 'exercises')

function findJsonFiles(dir: string, typeFilter?: string): string[] {
  if (!existsSync(dir)) return []

  const results: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const full = resolve(dir, entry)
    const stat = statSync(full)

    if (stat.isDirectory()) {
      if (entry.startsWith('_')) continue
      if (typeFilter && entry !== typeFilter) continue
      results.push(...findJsonFiles(full))
    } else if (entry.endsWith('.json')) {
      results.push(full)
    }
  }

  return results
}

function findExerciseFiles(): string[] {
  const levels = level ? [level] : ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']
  const files: string[] = []

  for (const l of levels) {
    const dir = resolve(DATA_DIR, l)
    files.push(...findJsonFiles(dir, type))
  }

  return files
}

// ---------------------------------------------------------------------------
// Transform to DynamoDB items
// ---------------------------------------------------------------------------

function buildItems(exercises: SeededExercise[], filePath: string): DynamoItem[] {
  const timestamp = new Date().toISOString()
  const fileSlug = basename(filePath, '.json')

  return exercises.map((exercise, index) => {
    const exerciseId = `seed-${fileSlug}-${index}`

    return {
      PK: `USER#${userId}`,
      SK: `EXERCISE#${exerciseId}`,
      GSI2PK: `USER#${userId}#WRITING_POOL`,
      GSI2SK: `pending#${timestamp}`,
      exercise_id: exerciseId,
      type: exercise.type,
      status: 'pending',
      source: 'auto',
      priority: 'normal',
      prompt: exercise.prompt,
      reference_answer: exercise.reference_answer,
      alternatives: exercise.alternatives || [],
      target_vocabulary: [],
      grammar_focus: exercise.grammar_focus,
      topic_id: exercise.topic_id,
      cefr_level: exercise.cefr_level,
      generated_at: timestamp,
    }
  })
}

// ---------------------------------------------------------------------------
// DynamoDB write (lazy-loaded to avoid import errors in dry-run)
// ---------------------------------------------------------------------------

async function batchWrite(tableName: string, items: DynamoItem[]): Promise<number> {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient, BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb')

  const rawClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' })
  const client = DynamoDBDocumentClient.from(rawClient)

  let written = 0

  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25)
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map(item => ({
            PutRequest: { Item: item },
          })),
        },
      })
    )
    written += chunk.length
  }

  return written
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tableName = process.env.TABLE_NAME || 'taaltuig-main'

  const files = findExerciseFiles()

  if (files.length === 0) {
    console.log('No exercise files found.')
    console.log(`Looked in: ${resolve(DATA_DIR)}`)
    process.exit(0)
  }

  console.log(`Found ${files.length} exercise file(s)`)
  if (dryRun) console.log('DRY RUN — no items will be written\n')

  let totalExercises = 0
  let totalWritten = 0

  for (const file of files) {
    const relativePath = file.replace(resolve(DATA_DIR) + '/', '')
    const raw = readFileSync(file, 'utf-8')
    let exercises: SeededExercise[]

    try {
      exercises = JSON.parse(raw)
    } catch {
      console.error(`  SKIP ${relativePath} — invalid JSON`)
      continue
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      console.error(`  SKIP ${relativePath} — empty or not an array`)
      continue
    }

    const items = buildItems(exercises, file)
    totalExercises += items.length

    if (dryRun) {
      console.log(`  ${relativePath}: ${items.length} exercises`)
    } else {
      const written = await batchWrite(tableName, items)
      totalWritten += written
      console.log(`  ${relativePath}: ${written} exercises written`)
    }
  }

  console.log('')
  if (dryRun) {
    console.log(`Would write ${totalExercises} exercises to ${tableName} for user ${userId}`)
  } else {
    console.log(`Written ${totalWritten} exercises to ${tableName} for user ${userId}`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
