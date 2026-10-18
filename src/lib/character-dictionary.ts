import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/database.types"

export type CharacterDictionaryEntry = {
  pinyin: string[]
  definition: string | null
  definition_en: string | null
  decomposition: string
  radical: string
  matches: Json
  components: string[]
  etymology?: {
    type: string | null
    hint: string | null
    hint_en: string | null
    semantic: string | null
    phonetic: string | null
  }
}

export type CharacterDictionary = Record<string, CharacterDictionaryEntry>

type CharacterClient = SupabaseClient<Database>

const CHARACTER_COLUMNS = "character, pinyin, decomposition, radical, matches, definition, definition_en, etymology_type, etymology_hint, etymology_hint_en, etymology_semantic, etymology_phonetic"

function asStringArray(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function mapCharacterRow(row: Database["public"]["Tables"]["characters"]["Row"]): CharacterDictionaryEntry {
  const hasEtymology = Boolean(
    row.etymology_type || row.etymology_hint || row.etymology_hint_en
      || row.etymology_semantic || row.etymology_phonetic
  )

  return {
    pinyin: asStringArray(row.pinyin),
    definition: row.definition,
    definition_en: row.definition_en,
    decomposition: row.decomposition,
    radical: row.radical,
    matches: row.matches,
    components: [],
    ...(hasEtymology && {
      etymology: {
        type: row.etymology_type,
        hint: row.etymology_hint,
        hint_en: row.etymology_hint_en,
        semantic: row.etymology_semantic,
        phonetic: row.etymology_phonetic,
      },
    }),
  }
}

export async function fetchCharacterEntries(
  supabase: CharacterClient,
  characters: string[]
): Promise<CharacterDictionary> {
  const uniqueCharacters = [...new Set(characters.filter(Boolean))]
  if (!uniqueCharacters.length) return {}

  const { data, error } = await supabase
    .from("characters")
    .select(CHARACTER_COLUMNS)
    .in("character", uniqueCharacters)

  if (error) throw error

  return Object.fromEntries((data ?? []).map((row) => [row.character, mapCharacterRow(row)]))
}

async function fetchComponents(
  supabase: CharacterClient,
  characters: string[]
): Promise<Record<string, string[]>> {
  const uniqueCharacters = [...new Set(characters.filter(Boolean))]
  if (!uniqueCharacters.length) return {}

  const { data, error } = await supabase
    .from("character_components")
    .select("character, position, component")
    .in("character", uniqueCharacters)
    .order("position", { ascending: true })

  if (error) throw error

  const result: Record<string, string[]> = {}
  for (const row of data ?? []) {
    ;(result[row.character] ??= []).push(row.component)
  }
  return result
}

/** Load selected characters plus one level of component details for the UI. */
export async function fetchCharacterDictionary(
  supabase: CharacterClient,
  characters: string[]
): Promise<CharacterDictionary> {
  const uniqueCharacters = [...new Set(characters.filter(Boolean))]
  if (!uniqueCharacters.length) return {}

  const [entries, components] = await Promise.all([
    fetchCharacterEntries(supabase, uniqueCharacters),
    fetchComponents(supabase, uniqueCharacters),
  ])

  const componentCharacters = [...new Set(Object.values(components).flat())]
    .filter((character) => !uniqueCharacters.includes(character))
  const [componentEntries, nestedComponents] = componentCharacters.length
    ? await Promise.all([
      fetchCharacterEntries(supabase, componentCharacters),
      fetchComponents(supabase, componentCharacters),
    ])
    : [{}, {}]

  const merged = { ...entries, ...componentEntries }
  const allComponents = { ...nestedComponents, ...components }
  for (const [character, entry] of Object.entries(merged)) {
    merged[character] = { ...entry, components: allComponents[character] ?? [] }
  }

  return merged
}
