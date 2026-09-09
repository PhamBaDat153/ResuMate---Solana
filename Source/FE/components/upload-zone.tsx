'use client'

import { useId, useRef } from 'react'

interface UploadZoneProps {
  name: string
  accept: string
  file: File | null
  onFileChange: (file: File | null) => void
  hint: string
  disabled?: boolean
}

export function UploadZone({
  name,
  accept,
  file,
  onFileChange,
  hint,
  disabled = false,
}: UploadZoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    onFileChange(selected)
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault()
          } else if (file) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-low bg-card px-6 py-10 text-center transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-foreground/30'}`}
      >
        {file ? (
          <>
            <p className="mb-1 font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted">{hint}</p>
          </>
        ) : (
          <>
            <p className="mb-1 mt-1 font-bold text-foreground">
              Kéo thả hoặc chọn file
            </p>
            <p className="text-muted">{hint}</p>
          </>
        )}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}
