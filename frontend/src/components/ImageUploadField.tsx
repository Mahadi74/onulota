/**
 * ImageUploadField
 *
 * Dual-mode image input: paste a URL OR upload a local file.
 * On file upload, calls POST /api/upload/image and resolves the Cloudinary URL.
 */

import { useRef, useState } from 'react'
import apiClient from '@/services/api/client'
import { Upload, Link, X, Loader2, ImageIcon } from 'lucide-react'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
  required?: boolean
  error?: string
  /** 'product' returns { urls: {thumbnail,mobile,desktop} }, 'category' returns { url } */
  uploadType?: 'product' | 'category' | 'general'
  className?: string
}

export function ImageUploadField({
  value,
  onChange,
  label = 'Image',
  required,
  error,
  uploadType = 'general',
  className = '',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const type = uploadType === 'product' ? 'product' : 'category'
      const res = await apiClient.post(`/api/upload/image?type=${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // product → res.data.urls.desktop; category/general → res.data.url
      const url: string = res.data?.url ?? res.data?.urls?.desktop ?? ''
      onChange(url)
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 w-fit">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition
            ${mode === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          <Link className="w-3.5 h-3.5" /> URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition
            ${mode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* URL input */}
      {mode === 'url' && (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* File upload */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-50 w-full justify-center"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Click to choose file (JPEG, PNG, WebP · max 10MB)</>
            )}
          </button>
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="mt-2 relative w-fit">
          <img
            src={value}
            alt="Preview"
            className="h-20 w-auto object-contain rounded-lg border border-gray-200 bg-gray-50 p-1"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-gray-400 hover:text-red-500 shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* No image placeholder */}
      {!value && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <ImageIcon className="w-4 h-4" /> No image selected
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
