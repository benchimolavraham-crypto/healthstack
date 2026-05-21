import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-3">HealthStack</h1>
        <p className="text-gray-400 text-lg max-w-md">
          Your genome, blood work, wearables, and nutrition — all in one place.
          AI tells you exactly what to do.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/upload"
          className="border border-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-black transition"
        >
          Upload Data
        </Link>
      </div>
    </main>
  )
}
