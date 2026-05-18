/**
 * Safe localStorage utilities that handle parsing errors gracefully
 * Prevents app crashes from corrupted localStorage data
 */

/**
 * Safely parse JSON with fallback value
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed object or fallback value
 */
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Failed to parse JSON from localStorage:', error);
    return fallback;
  }
}

/**
 * Safely get item from localStorage
 * @param key - localStorage key
 * @param fallback - Value to return if key doesn't exist or parsing fails
 * @returns Parsed value or fallback
 */
export function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return safeJsonParse(item, fallback);
  } catch (error) {
    console.error(`Failed to get ${key} from localStorage:`, error);
    return fallback;
  }
}

/**
 * Safely set item in localStorage
 * @param key - localStorage key
 * @param value - Value to store (will be JSON stringified)
 */
export function safeSetItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
}

/**
 * Set item in localStorage, re-throwing any error so the caller can react
 * (e.g. show an error toast). Use this when the UI needs to distinguish
 * between a successful and a failed write.
 */
export function setItemOrThrow(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Safely remove item from localStorage
 * @param key - localStorage key to remove
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove ${key} from localStorage:`, error);
  }
}

/**
 * Safely clear all localStorage
 */
export function safeClearStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}
