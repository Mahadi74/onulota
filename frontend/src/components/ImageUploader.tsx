/**
 * ImageUploader — reusable component for admin image fields.
 *
 * Supports two modes:
 *   1. URL input  — paste any https:// URL
 *   2. File upload — pick a file, uploads to POST /api/upload/image and returns S3 URL(s)
 *
 * Props:
 *   value       — current URL string (for display / URL tab)
 *   onChange    — called with the final URL string when set
 *   onUpload    — (optional) called with full { urls } object for product (thumbnail/mobile/desktop)
 *   type        — 'product' | 'category' (default 'category')
 *   label       — field label
 *   placeholder — URL input placeholder
 */

import { useState, useRef } from 'react'
import { Upload, Link2, X, Loader2 } from 'lucide-react'
import apiClient from '@/services/api/client'

interface ProductUrls {
  thumbnail: string
  mobile: string
  desktop: string
}

interface ImageUploaderProps {
  value?: string
  onChange: (url: string) => void
  onUpload?: (urls: ProductUrls) => void
  type?: 'product' | 'category'
  label?: string
  placeholder?: string
  className?: string
}

export function ImageUploader({
  value,
  onChange,
  onUpload,
  type = 'category',
  label,
  placeholder = 'https://example.com/image.jpg',
  className = '',
}: ImageUploaderProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await apiClient.post(`/api/upload/image?type=${type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (type === 'product') {
        const urls: ProductUrls = res.data.urls
        onChange(urls.desktop) // set main URL to desktop version
        onUpload?.(urls)
      } else {
        onChange(res.data.url)
      }
      setTab('url') // switch back to show preview
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-2 w-fit">
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" /> URL
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* URL tab */}
      {tab === 'url' && (
        <input
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-500">Uploading to S3…</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-slate-400" />
              <p className="text-xs text-slate-500 text-center">
                <span className="font-semibold text-blue-600">Click to upload</span> or drag & drop<br />
                JPEG, PNG, WebP · max 10 MB
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}

      {/* Preview */}
      {value && (
        <div className="mt-2 flex items-center gap-3">
          <img
            src={value}
            alt="Preview"
            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
