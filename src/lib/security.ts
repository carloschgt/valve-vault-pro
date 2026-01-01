/**
 * Security utilities for input sanitization
 */

/**
 * Escapes special characters in PostgreSQL ILIKE patterns to prevent
 * pattern injection and performance abuse.
 * 
 * Characters escaped: % (wildcard), _ (single char), \ (escape)
 * 
 * @param input - User-provided search string
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized string safe for ILIKE queries
 */
export function escapeILikePattern(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Truncate to max length
  const truncated = input.slice(0, maxLength);
  
  // Escape special ILIKE characters: \ must be escaped first
  return truncated
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Validates and sanitizes a search term for database queries.
 * Returns empty string if input is invalid.
 * 
 * @param input - User-provided search string
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized search term
 */
export function sanitizeSearchTerm(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes and control characters
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  
  // Apply ILIKE escaping
  return escapeILikePattern(cleaned, maxLength);
}
