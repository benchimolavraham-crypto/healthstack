import { NextResponse } from 'next/server'
import { analyzeHealth } from '@/lib/anthropic'
import sql from '@/lib/db'

export async function POST(req: Request) {
  const { userId, userNotes } = await req.json()

  const [bloodMarkers, whoopData, geneticVariants] = await Promise.all([
    sql`SELECT * FROM blood_markers WHERE user_id = ${userId} ORDER BY drawn_at DESC`,
    sql`SELECT * FROM whoop_cycles WHERE user_id = ${userId} ORDER BY date DESC LIMIT 7`,
    sql`SELECT * FROM genetic_variants WHERE user_id = ${userId}`,
  ])

  const result = await analyzeHealth({
    bloodMarkers: bloodMarkers as never,
    whoopData: whoopData as never,
    geneticVariants: geneticVariants as never,
    userNotes,
  })

  await sql`
    INSERT INTO ai_recommendations (user_id, category, recommendation, reasoning, sources, priority)
    VALUES (${userId}, 'general', ${result}, 'Full data analysis', ARRAY['bloodwork','whoop','genome'], 'high')
  `

  return NextResponse.json({ result })
}
