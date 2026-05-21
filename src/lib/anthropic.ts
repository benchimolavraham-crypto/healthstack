import Anthropic from '@anthropic-ai/sdk'
import type { BloodMarker, GeneticVariant, WhoopCycle } from '@/types/health'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface HealthContext {
  bloodMarkers?: BloodMarker[]
  whoopData?: WhoopCycle[]
  geneticVariants?: GeneticVariant[]
  userNotes?: string
}

export async function analyzeHealth(context: HealthContext): Promise<string> {
  const datasummary = buildDataSummary(context)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `You are a longevity and health optimization expert. You analyze personal health data and provide actionable, evidence-based recommendations.
You cover: nutrition, supplements (vitamins, peptides, minerals), exercise programming, sleep optimization, and lifestyle changes.
Always cite which data points led to each recommendation. Be specific with dosages and timing when recommending supplements.
Flag anything that needs a doctor's review. Format your response in clear sections.`,
    messages: [
      {
        role: 'user',
        content: `Here is my current health data. Please analyze it and give me your top recommendations:\n\n${datasummary}`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

function buildDataSummary(context: HealthContext): string {
  const parts: string[] = []

  if (context.bloodMarkers?.length) {
    parts.push('## Blood Work')
    context.bloodMarkers.forEach((m) => {
      const flag = m.reference_min && m.value < m.reference_min ? ' [LOW]'
        : m.reference_max && m.value > m.reference_max ? ' [HIGH]' : ''
      parts.push(`- ${m.marker}: ${m.value} ${m.unit}${flag}`)
    })
  }

  if (context.whoopData?.length) {
    const latest = context.whoopData[0]
    parts.push('\n## Recent Whoop Data (latest day)')
    parts.push(`- Recovery: ${latest.recovery_score}%`)
    parts.push(`- HRV: ${latest.hrv} ms`)
    parts.push(`- Resting HR: ${latest.resting_hr} bpm`)
    parts.push(`- Sleep: ${latest.sleep_hours} hours`)
    parts.push(`- Strain: ${latest.strain}`)
  }

  if (context.geneticVariants?.length) {
    parts.push('\n## Notable Genetic Variants')
    context.geneticVariants.forEach((v) => {
      parts.push(`- ${v.gene} (${v.rsid}): ${v.genotype} — ${v.notes ?? 'no notes'}`)
    })
  }

  if (context.userNotes) {
    parts.push(`\n## Additional Context\n${context.userNotes}`)
  }

  return parts.join('\n')
}
