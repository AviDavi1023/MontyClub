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