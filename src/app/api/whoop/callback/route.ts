import { NextResponse } from 'next/server'

// Whoop OAuth callback — exchange code for access token
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 })

  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/whoop/callback`,
    }),
  })

  const tokens = await res.json()
  // TODO: store tokens in Supabase and sync cycles
  return NextResponse.redirect('/dashboard?whoop=connected')
}
