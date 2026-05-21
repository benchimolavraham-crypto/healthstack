'use client'

import { useState } from 'react'

const DEMO_USER_ID = 'abe'

export default function Dashboard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')

  async function runAnalysis() {
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DEMO_USER_ID, userNotes: notes }),
      })
      const data = await res.json()
      setResult(data.result)
    } catch {
      setResult('Error running analysis. Check your API keys and data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Your Health Dashboard</h1>
      <p className="text-gray-400 mb-8">Connect your data sources, then run a full AI analysis.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <DataCard title="Genome" status="not connected" action="/upload?type=genome" />
        <DataCard title="Blood Work" status="not connected" action="/upload?type=bloodwork" />
        <DataCard title="Whoop" status="not connected" action="/api/whoop/connect" />
      </div>

      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Anything you want Claude to know? (symptoms, goals, current supplements)
        </label>
        <textarea
          className="w-full bg-gray-800 rounded-lg p-3 text-white resize-none h-24 text-sm"
          placeholder="e.g. I've been feeling tired in the afternoons, I'm trying to build muscle, I currently take vitamin D..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        onClick={runAnalysis}
        disabled={loading}
        className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
      >
        {loading ? 'Analyzing...' : 'Run Full Analysis'}
      </button>

      {result && (
        <div className="mt-8 bg-gray-900 rounded-xl p-6 whitespace-pre-wrap text-sm leading-relaxed">
          {result}
        </div>
      )}
    </div>
  )
}

function DataCard({ title, status, action }: { title: string; status: string; action: string }) {
  return (
    <a
      href={action}
      className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition"
    >
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{status}</p>
    </a>
  )
}
