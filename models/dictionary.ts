import { Dictionary, DictionaryCategory } from "@/types/dictionary";
import { prisma } from "@/lib/prisma";

/**
 * Get dictionaries by category or multiple categories
 */
export async function getDictionariesByCategory(
  category: DictionaryCategory | DictionaryCategory[],
  type?: string
): Promise<Dictionary[]> {
  const categories = Array.isArray(category) ? category : [category];

  const dictionaries = await prisma.dictionaries.findMany({
    where: {
      category: {
        in: categories
      },
      is_active: true,
      ...(type ? { type } : {}),
    },
    orderBy: {
      sort_order: 'asc',
    },
  });

  return dictionaries.map(formatDictionary);
}

/**
 * Get dictionary by category and key
 */
export async function getDictionaryByKey(
  category: DictionaryCategory,
  key: string
): Promise<Dictionary | null> {
  const dictionary = await prisma.dictionaries.findUnique({
    where: {
      category_key: {
        category: category,
        key: key,
      },
    },
  });

  if (!dictionary) {
    return null;
  }

  return formatDictionary(dictionary);
}

/**
 * Format dictionary row to Dictionary type
 */
export function formatDictionary(row: any): Dictionary {
  return {
    id: row.id,
    category: row.category,
    key: row.key,
    type: row.type || undefined,
    label_en: row.label_en || undefined,
    label_zh: row.label_zh || undefined,
    sort_order: row.sort_order,
    is_active: row.is_active,
    created_at: row.created_at ? row.created_at.toISOString() : undefined,
    updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
  };
}

/**
 * Insert or update dictionary
 */
export async function upsertDictionary(dictionary: Dictionary): Promise<Dictionary> {
  const now = new Date();
  
  const result = await prisma.dictionaries.upsert({
    where: {
      category_key: {
        category: dictionary.category,
        key: dictionary.key,
      },
    },
    update: {
      type: dictionary.type,
      label_en: dictionary.label_en,
      label_zh: dictionary.label_zh,
      sort_order: dictionary.sort_order,
      is_active: dictionary.is_active,
      updated_at: now,
    },
    create: {
      category: dictionary.category,
      key: dictionary.key,
      type: dictionary.type,
      label_en: dictionary.label_en,
      label_zh: dictionary.label_zh,
      sort_order: dictionary.sort_order,
      is_active: dictionary.is_active,
      created_at: now,
      updated_at: now,
    },
  });

  return formatDictionary(result);
}
