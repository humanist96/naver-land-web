export const AUTH = {
  ACCESS_TOKEN_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY: '7d',
  ACCESS_TOKEN_MAX_AGE: 60 * 60,           // 1 hour in seconds
  REFRESH_TOKEN_MAX_AGE: 60 * 60 * 24 * 7, // 7 days in seconds
  COOKIE_NAME_ACCESS: 'access_token',
  COOKIE_NAME_REFRESH: 'refresh_token',
} as const

export const SEARCH = {
  DEFAULT_LIMIT: 1000,
  DEFAULT_SORT: 'rank',
  DEFAULT_PROPERTY_TYPE: 'APT:JGC',
  CLI_TIMEOUT_MS: 30000,
  CACHE_TTL_SECONDS: 300, // 5 minutes
} as const

export const COLLECTOR = {
  DEFAULT_SCHEDULE: '0 */6 * * *', // every 6 hours
  MAX_CONCURRENT_JOBS: 3,
  BATCH_DELAY_MS: 10000, // 10 seconds between districts
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const
