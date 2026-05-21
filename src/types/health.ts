export type DataSourceType =
  | 'genome'
  | 'bloodwork'
  | 'whoop'
  | 'oura'
  | 'cronometer'
  | 'apple_health'
  | 'cgm'
  | 'manual'

export interface DataUpload {
  id: string
  user_id: string
  source: DataSourceType
  filename: string
  uploaded_at: string
  parsed: boolean
  raw_url: string
}

export interface WhoopCycle {
  id: string
  user_id: string
  date: string
  recovery_score: number
  hrv: number
  resting_hr: number
  sleep_hours: number
  strain: number
  raw: Record<string, unknown>
}

export interface BloodMarker {
  id: string
  user_id: string
  drawn_at: string
  marker: string
  value: number
  unit: string
  reference_min: number | null
  reference_max: number | null
}

export interface GeneticVariant {
  id: string
  user_id: string
  rsid: string
  gene: string
  genotype: string
  significance: string | null
  notes: string | null
}

export interface AIRecommendation {
  id: string
  user_id: string
  created_at: string
  category: 'nutrition' | 'supplements' | 'exercise' | 'sleep' | 'general'
  recommendation: string
  reasoning: string
  sources: DataSourceType[]
  priority: 'high' | 'medium' | 'low'
}
