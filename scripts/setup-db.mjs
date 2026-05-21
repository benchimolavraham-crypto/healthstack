import { neon } from '@neondatabase/serverless'

const sql = neon('postgresql://neondb_owner:npg_gMdtubW9cB0X@ep-twilight-silence-aq8syix7.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require')

await sql`
  CREATE TABLE IF NOT EXISTS blood_markers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    drawn_at timestamptz NOT NULL,
    marker text NOT NULL,
    value numeric NOT NULL,
    unit text NOT NULL,
    reference_min numeric,
    reference_max numeric,
    created_at timestamptz DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS whoop_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    date date NOT NULL,
    recovery_score numeric,
    hrv numeric,
    resting_hr numeric,
    sleep_hours numeric,
    strain numeric,
    raw jsonb,
    created_at timestamptz DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS genetic_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    rsid text,
    gene text,
    genotype text,
    significance text,
    notes text,
    created_at timestamptz DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS ai_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    category text NOT NULL,
    recommendation text NOT NULL,
    reasoning text,
    sources text[],
    priority text,
    created_at timestamptz DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS data_uploads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    source text NOT NULL,
    filename text NOT NULL,
    raw_url text,
    parsed boolean DEFAULT false,
    uploaded_at timestamptz DEFAULT now()
  )
`

console.log('All tables created successfully!')
