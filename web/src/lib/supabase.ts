import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

function getSupabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

// Client-side (anon key, RLS enforced)
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())
  }
  return _supabase
}

// Server-side (service role, bypasses RLS)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceKey())
  }
  return _supabaseAdmin
}

// Backward-compatible exports (lazy via getter)
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver)
  },
})

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver)
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          status: string
          role: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          status?: string
          role?: string
        }
        Update: {
          status?: string
          role?: string
          approved_at?: string
          approved_by?: string
          updated_at?: string
        }
      }
      listings: {
        Row: {
          id: string
          atcl_no: string
          atcl_nm: string
          district_code: string
          district_name: string
          city_name: string
          trade_type: string
          property_type: string
          exclusive_area: number
          supply_area: number
          pyeong: number
          size_type: string
          price: number
          price_display: string
          rent_price: number | null
          floor_info: string | null
          confirm_date: string | null
          tags: string[]
          lat: number
          lng: number
          naver_url: string
          collected_at: string
          snapshot_id: string
        }
      }
      listing_changes: {
        Row: {
          id: string
          atcl_no: string
          atcl_nm: string
          change_type: string
          old_price: number | null
          new_price: number | null
          price_diff: number | null
          price_diff_percent: number | null
          district_code: string
          district_name: string
          trade_type: string
          detected_at: string
          snapshot_id: string
        }
      }
      market_snapshots: {
        Row: {
          id: string
          district_code: string
          district_name: string
          snapshot_date: string
          trade_type: string
          total_count: number
          avg_price: number
          median_price: number
          min_price: number
          max_price: number
          size_distribution: Record<string, number>
          new_count: number
          removed_count: number
          price_up_count: number
          price_down_count: number
          snapshot_id: string
          created_at: string
        }
      }
      collection_jobs: {
        Row: {
          id: string
          district_code: string
          district_name: string
          city_name: string
          trade_types: string[]
          property_types: string[]
          schedule: string
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          last_error: string | null
          total_count: number | null
          change_count: number | null
          created_by: string
          created_at: string
        }
      }
    }
  }
}
