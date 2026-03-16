import { supabaseAdmin } from '@/lib/supabase'
import { formatPriceShort } from '@/domain/price'
import type { DashboardOverview, PriceTrendData, SizeDistributionData } from '@/types/dashboard'
import type { ListingChange } from '@/types/listing'

export async function getOverview(
  districtName: string,
  tradeType: string = '매매'
): Promise<DashboardOverview> {
  const { data: snapshots } = await supabaseAdmin
    .from('market_snapshots')
    .select('*')
    .eq('district_name', districtName)
    .eq('trade_type', tradeType)
    .order('snapshot_date', { ascending: false })
    .limit(2)

  if (!snapshots || snapshots.length === 0) {
    return {
      current: { totalCount: 0, avgPrice: 0, avgPriceDisplay: '-', medianPrice: 0, newToday: 0, removedToday: 0 },
      previous: { totalCount: 0, avgPrice: 0 },
      changes: { countDiff: 0, countDiffPercent: 0, priceDiff: 0, priceDiffPercent: 0 },
    }
  }

  const current = snapshots[0]
  const previous = snapshots[1] || current

  const countDiff = current.total_count - previous.total_count
  const priceDiff = current.avg_price - previous.avg_price

  return {
    current: {
      totalCount: current.total_count,
      avgPrice: current.avg_price,
      avgPriceDisplay: formatPriceShort(current.avg_price),
      medianPrice: current.median_price,
      newToday: current.new_count,
      removedToday: current.removed_count,
    },
    previous: {
      totalCount: previous.total_count,
      avgPrice: previous.avg_price,
    },
    changes: {
      countDiff,
      countDiffPercent: previous.total_count > 0
        ? Math.round((countDiff / previous.total_count) * 1000) / 10
        : 0,
      priceDiff,
      priceDiffPercent: previous.avg_price > 0
        ? Math.round((priceDiff / previous.avg_price) * 1000) / 10
        : 0,
    },
  }
}

export async function getPriceTrend(
  districtName: string,
  period: string = '1m',
  tradeTypes: string[] = ['매매', '전세']
): Promise<PriceTrendData> {
  const daysMap: Record<string, number> = {
    '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365,
  }
  const days = daysMap[period] || 30
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: snapshots } = await supabaseAdmin
    .from('market_snapshots')
    .select('snapshot_date, trade_type, avg_price')
    .eq('district_name', districtName)
    .in('trade_type', tradeTypes)
    .gte('snapshot_date', since.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) {
    return { labels: [], datasets: [] }
  }

  const dateSet = new Set<string>()
  const byType: Record<string, Record<string, number>> = {}

  for (const s of snapshots) {
    dateSet.add(s.snapshot_date)
    if (!byType[s.trade_type]) byType[s.trade_type] = {}
    byType[s.trade_type][s.snapshot_date] = s.avg_price
  }

  const labels = Array.from(dateSet).sort()
  const datasets = tradeTypes
    .filter(tt => byType[tt])
    .map(tt => ({
      label: tt,
      data: labels.map(d => byType[tt]?.[d] ?? 0),
      unit: '만원',
    }))

  return { labels, datasets }
}

export async function getListingChanges(
  districtName: string,
  days: number = 7
): Promise<{ labels: string[]; newCounts: number[]; removedCounts: number[] }> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: snapshots } = await supabaseAdmin
    .from('market_snapshots')
    .select('snapshot_date, new_count, removed_count')
    .eq('district_name', districtName)
    .gte('snapshot_date', since.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) {
    return { labels: [], newCounts: [], removedCounts: [] }
  }

  return {
    labels: snapshots.map(s => s.snapshot_date),
    newCounts: snapshots.map(s => s.new_count),
    removedCounts: snapshots.map(s => s.removed_count),
  }
}

export async function getSizeDistribution(
  districtName: string,
  tradeType: string = '매매'
): Promise<SizeDistributionData[]> {
  const { data: snapshots } = await supabaseAdmin
    .from('market_snapshots')
    .select('size_distribution')
    .eq('district_name', districtName)
    .eq('trade_type', tradeType)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (!snapshots || snapshots.length === 0) return []

  const dist = snapshots[0].size_distribution as Record<string, number>
  const total = Object.values(dist).reduce((s, v) => s + v, 0)
  if (total === 0) return []

  const nameMap: Record<string, string> = {
    small: '소형', twenty: '20평대', thirty: '30평대', large: '중대형',
  }

  return Object.entries(dist).map(([key, value]) => ({
    name: nameMap[key] || key,
    value,
    percentage: Math.round((value / total) * 1000) / 10,
  }))
}

export async function getTradeComparison(
  districtName: string
): Promise<{ tradeType: string; avgPrice: number; avgPriceDisplay: string; count: number }[]> {
  const { data: snapshots } = await supabaseAdmin
    .from('market_snapshots')
    .select('trade_type, avg_price, total_count, snapshot_date')
    .eq('district_name', districtName)
    .order('snapshot_date', { ascending: false })
    .limit(10)

  if (!snapshots || snapshots.length === 0) return []

  const latest: Record<string, typeof snapshots[0]> = {}
  for (const s of snapshots) {
    if (!latest[s.trade_type]) latest[s.trade_type] = s
  }

  return Object.values(latest).map(s => ({
    tradeType: s.trade_type,
    avgPrice: s.avg_price,
    avgPriceDisplay: formatPriceShort(s.avg_price),
    count: s.total_count,
  }))
}

export async function getRecentChanges(
  districtName: string,
  changeType?: string,
  limit: number = 20
): Promise<{ changes: ListingChange[]; summary: Record<string, number> }> {
  let query = supabaseAdmin
    .from('listing_changes')
    .select('*')
    .eq('district_name', districtName)
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (changeType && changeType !== 'all') {
    query = query.eq('change_type', changeType)
  }

  const { data } = await query

  const changes: ListingChange[] = (data || []).map(row => ({
    id: row.id,
    atclNo: row.atcl_no,
    atclNm: row.atcl_nm,
    changeType: row.change_type,
    oldPrice: row.old_price,
    newPrice: row.new_price,
    priceDiff: row.price_diff,
    priceDiffPercent: row.price_diff_percent,
    districtCode: row.district_code,
    districtName: row.district_name,
    tradeType: row.trade_type,
    detectedAt: row.detected_at,
    snapshotId: row.snapshot_id,
  }))

  const summary = {
    new: (data || []).filter(r => r.change_type === 'new').length,
    removed: (data || []).filter(r => r.change_type === 'removed').length,
    price_up: (data || []).filter(r => r.change_type === 'price_up').length,
    price_down: (data || []).filter(r => r.change_type === 'price_down').length,
  }

  return { changes, summary }
}
