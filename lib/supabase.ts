import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function readJSONFromStorage(path: string) {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.storage
      .from('club-data')
      .download(path)

    if (error) {
      console.warn('Error reading from Supabase:', error)
      return null
    }

    const text = await data.text()
    return JSON.parse(text)
  } catch (e) {
    console.warn('Error reading from Supabase:', e)
    return null
  }
}

export async function writeJSONToStorage(path: string, data: any) {
  if (!supabase) return false

  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })

    const { error } = await supabase.storage
      .from('club-data')
      .upload(path, blob, {
        upsert: true,
        contentType: 'application/json'
      })

    if (error) {
      console.warn('Error writing to Supabase:', error)
      return false
    }

    return true
  } catch (e) {
    console.warn('Error writing to Supabase:', e)
    return false
  }
}

export async function listPaths(prefix: string) {
  if (!supabase) return []
  try {
    const all: string[] = []
    let page = 0
    const size = 100
    // paginate through folder
    // Supabase storage list is not recursive, so we iterate shallow and recurse manually
    async function walk(dir: string) {
      let from = 0
      while (true) {
        const { data, error } = await supabase.storage.from('club-data').list(dir, { limit: size, offset: from })
        if (error) break
        if (!data || data.length === 0) break
        for (const item of data) {
          if (item.name.endsWith('/')) continue
          if (item.id) {
            // newer SDK returns id/name; build path from dir+name
          }
          const childPath = dir ? `${dir}/${item.name}` : item.name
          if (item.metadata && (item as any).metadata?.size === 0 && item.name.endsWith('/')) {
            // folder marker, skip
          }
          if ((item as any).id === undefined && (item as any).metadata === undefined && item.name.includes('/')) {
            // safety
          }
          if ((item as any).id !== undefined && item.name === '') continue
          if ((item as any).id !== undefined && item.name.endsWith('/')) continue
          if ((item as any).id !== undefined) {
            // continue
          }
          if ((item as any).id === undefined && (item as any).updated_at === undefined && item.name) {
            // continue
          }
          if ((item as any).id === undefined && item.name && (item as any).metadata?.mimetype === 'application/octet-stream') {
            // continue
          }
          // If item has no subpath, it's file. If it has .id only, also file.
          if ((item as any).id || (item as any).updated_at || (item as any).metadata) {
            all.push(childPath)
          } else {
            // Could be folder-like; attempt to walk it
            await walk(childPath)
          }
        }
        if (data.length < size) break
        from += size
      }
    }
    await walk(prefix)
    return all
  } catch (e) {
    console.warn('Error listing from Supabase:', e)
    return []
  }
}

export async function removePaths(paths: string[]) {
  if (!supabase || paths.length === 0) return { removed: 0 }
  try {
    const { data, error } = await supabase.storage.from('club-data').remove(paths)
    if (error) {
      console.warn('Error removing from Supabase:', error)
      return { removed: 0 }
    }
    return { removed: data?.length || 0 }
  } catch (e) {
    console.warn('Error removing from Supabase:', e)
    return { removed: 0 }
  }
}