/**
 * Validation utilities for collections
 * Ensures data integrity and consistency
 */

import { RegistrationCollection } from '@/types/club'

/**
 * Validate collection state
 * @param collections Array of collections to validate
 * @returns List of validation errors (empty if valid)
 */
export function validateCollections(collections: RegistrationCollection[]): string[] {
  const errors: string[] = []
  
  // Check that at most one collection has display: true
  const displayCollections = collections.filter(c => c.display === true)
  if (displayCollections.length > 1) {
    errors.push(`Multiple collections marked as display (found ${displayCollections.length}). Only one should be marked.`)
  }
  
  // Check that all collections have required fields
  for (const collection of collections) {
    if (!collection.id || !collection.name) {
      errors.push(`Collection missing required fields: id or name`)
    }
    if (collection.createdAt && isNaN(new Date(collection.createdAt).getTime())) {
      errors.push(`Collection ${collection.id} has invalid createdAt timestamp: ${collection.createdAt}`)
    }
  }
  
  // Check for duplicate IDs
  const ids = new Set<string>()
  for (const collection of collections) {
    if (ids.has(collection.id)) {
      errors.push(`Duplicate collection ID: ${collection.id}`)
    }
    ids.add(collection.id)
  }
  
  return errors
}

/**
 * Ensure only one collection has display: true
 * If multiple have it, clear all but the most recent one
 * @param collections Array of collections
 * @returns Fixed collections array
 */
export function ensureSingleDisplay(collections: RegistrationCollection[]): RegistrationCollection[] {
  const displayCollections = collections.filter(c => c.display === true)
  
  if (displayCollections.length <= 1) {
    return collections
  }
  
  // Sort by createdAt (newest first) and keep only the first one
  const sorted = [...displayCollections].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })
  
  console.warn(`[Collections] Found ${displayCollections.length} collections with display=true, keeping only the newest`)
  
  // Return collections with only the newest having display: true
  return collections.map(c => ({
    ...c,
    display: c.id === sorted[0].id ? true : false
  }))
}

/**
 * Merge collection update with existing collection, validating state
 * @param existing Existing collection from database
 * @param updates Updates to apply
 * @returns Merged collection
 */
export function mergeCollectionUpdate(
  existing: RegistrationCollection,
  updates: Partial<RegistrationCollection>
): RegistrationCollection {
  const merged = { ...existing, ...updates }
  
  // Don't allow invalid timestamps
  if (updates.createdAt && isNaN(new Date(updates.createdAt).getTime())) {
    console.warn(`[Collections] Rejecting invalid createdAt: ${updates.createdAt}`)
    merged.createdAt = existing.createdAt
  }
  
  // Validate display flag
  if (updates.display === true) {
    console.log(`[Collections] Collection ${merged.id} marked as display`)
  }
  
  return merged
}
