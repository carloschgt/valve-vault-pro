/**
 * Wildcard search utilities
 * 
 * Allows users to use * as a wildcard character in search terms.
 * Examples:
 * - "002*" matches anything starting with "002"
 * - "*ABC" matches anything ending with "ABC"
 * - "002*1*" matches "002" followed by any characters, then "1", then any characters
 * - "ABC" (no wildcard) matches anything containing "ABC"
 */

/**
 * Converts a user search pattern with wildcards (*) to a RegExp.
 * If no wildcards are present, defaults to substring search (contains).
 * 
 * @param pattern - User-provided search pattern with optional * wildcards
 * @returns RegExp for matching
 */
export function wildcardToRegex(pattern: string): RegExp {
  if (!pattern || typeof pattern !== 'string') {
    return new RegExp('', 'i');
  }
  
  const trimmed = pattern.trim();
  if (!trimmed) {
    return new RegExp('', 'i');
  }
  
  // Check if pattern contains wildcards
  const hasWildcard = trimmed.includes('*');
  
  if (!hasWildcard) {
    // No wildcard: default to substring search (contains)
    const escaped = escapeRegexChars(trimmed);
    return new RegExp(escaped, 'i');
  }
  
  // Has wildcards: convert * to .*
  // First escape special regex characters except *
  const escaped = escapeRegexChars(trimmed, true);
  
  // Replace * with .* for regex
  const regexPattern = escaped.replace(/\*/g, '.*');
  
  // If pattern starts with *, don't anchor at start
  // If pattern ends with *, don't anchor at end
  const startsWithWildcard = trimmed.startsWith('*');
  const endsWithWildcard = trimmed.endsWith('*');
  
  let finalPattern = regexPattern;
  
  // Add anchors for more precise matching when wildcards are at specific positions
  if (!startsWithWildcard) {
    finalPattern = '^' + finalPattern;
  }
  if (!endsWithWildcard) {
    finalPattern = finalPattern + '$';
  }
  
  try {
    return new RegExp(finalPattern, 'i');
  } catch {
    // If regex is invalid, fallback to substring search
    return new RegExp(escapeRegexChars(trimmed), 'i');
  }
}

/**
 * Escapes special regex characters in a string
 * 
 * @param str - String to escape
 * @param preserveWildcard - If true, preserves * characters
 * @returns Escaped string
 */
function escapeRegexChars(str: string, preserveWildcard: boolean = false): string {
  // Special regex characters that need escaping
  const specialChars = preserveWildcard 
    ? /[.+?^${}()|[\]\\]/g 
    : /[.*+?^${}()|[\]\\]/g;
  
  return str.replace(specialChars, '\\$&');
}

/**
 * Tests if a value matches a wildcard pattern.
 * 
 * @param value - The value to test
 * @param pattern - The search pattern with optional * wildcards
 * @returns true if value matches the pattern
 */
export function matchesWildcard(value: string, pattern: string): boolean {
  if (!pattern || !pattern.trim()) {
    return true; // Empty pattern matches everything
  }
  
  if (!value) {
    return false;
  }
  
  const regex = wildcardToRegex(pattern);
  return regex.test(value);
}

/**
 * Tests if any of the provided values match the wildcard pattern.
 * Useful for searching across multiple fields.
 * 
 * @param values - Array of values to test
 * @param pattern - The search pattern with optional * wildcards
 * @returns true if any value matches the pattern
 */
export function matchesAnyWildcard(values: (string | undefined | null)[], pattern: string): boolean {
  if (!pattern || !pattern.trim()) {
    return true; // Empty pattern matches everything
  }
  
  const regex = wildcardToRegex(pattern);
  
  return values.some(value => {
    if (!value) return false;
    return regex.test(value);
  });
}

/**
 * Converts wildcard pattern to SQL ILIKE pattern for backend searches.
 * 
 * @param pattern - User-provided search pattern with * wildcards
 * @returns SQL ILIKE compatible pattern
 */
export function wildcardToILike(pattern: string): string {
  if (!pattern || typeof pattern !== 'string') {
    return '%';
  }
  
  const trimmed = pattern.trim();
  if (!trimmed) {
    return '%';
  }
  
  // Check if pattern contains wildcards
  const hasWildcard = trimmed.includes('*');
  
  // Escape SQL ILIKE special characters (% and _)
  let escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
  
  if (!hasWildcard) {
    // No wildcard: default to contains search
    return `%${escaped}%`;
  }
  
  // Replace * with % for SQL ILIKE
  escaped = escaped.replace(/\*/g, '%');
  
  return escaped;
}
