/**
 * CORS utilities for Edge Functions
 * Restricts origins to known application domains
 */

// List of allowed origins for CORS
const ALLOWED_ORIGINS = [
  // Production domains
  'https://bdetejjahokasedpghlp.lovableproject.com',
  // Lovable preview domains (pattern: *.lovable.app)
  // Development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Pattern for lovable.app subdomains
const LOVABLE_PATTERN = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;
const LOVABLE_PROJECT_PATTERN = /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/;

/**
 * Check if origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Check lovable.app pattern
  if (LOVABLE_PATTERN.test(origin)) return true;
  
  // Check lovableproject.com pattern
  if (LOVABLE_PROJECT_PATTERN.test(origin)) return true;
  
  return false;
}

/**
 * Get CORS headers for the given request
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsOptions(req: Request): Response {
  const origin = req.headers.get('origin');
  return new Response(null, { 
    status: 204,
    headers: getCorsHeaders(origin) 
  });
}
