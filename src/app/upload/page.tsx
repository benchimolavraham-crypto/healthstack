'use client'

import { useState } from 'react'

const SOURCES = [
  { id: 'genome', label: 'Genome (VCF file from Nebula/Sequencing.com)', accept: '.vcf,.txt,.csv' },
  { id: 'bloodwork', label: 'Blood Work (PDF or CSV from lab)', accept: '.pdf,.csv' },
  { id: 'cronometer', label: 'Cronometer Export (CSV)', accept: '.csv' },
  { id: 'apple_health', label: 'Apple Health Export (XML)', accept: '.xml,.zip' },
]

export default function Upload() {
  const [source, setSource] = useState('bloodwork')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')

  async function handleUpload() {
    if (!file) return
    setStatus('Uploading...')
    // TODO: upload to Supabase Storage, then trigger parsing
    setTimeout(() => setStatus('Uploaded! Parsing will happen in the background.'), 1000)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Upload Health Data</h1>
      <p className="text-gray-400 mb-8">Add your data and we'll parse it automatically.</p>

      <div className="space-y-4 mb-6">
        {SOURCES.map((s) => (
          <label key={s.id} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="source"
              value={s.id}
              checked={source === s.id}
              onChange={() => setSource(s.id)}
              className="mt-1"
            />
            <span className="text-sm">{s.label}</span>
          </label>
        ))}
      </div>

      <input
        type="file"
        accept={SOURCES.find((s) => s.id === source)?.accept}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-4 text-sm text-gray-300"
      />

      <button
        onClick={handleUpload}
        disabled={!file}
        className="bg-white text-black px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-40 transition"
      >
        Upload
      </button>

      {status && <p className="mt-4 text-sm text-green-400">{status}</p>}
    </div>
  )
}
