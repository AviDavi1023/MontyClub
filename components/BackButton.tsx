"use client"

import { ArrowLeft } from 'lucide-react'

export default function BackButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.history.back()}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="ml-2">Go Back</span>
    </button>
  )
}
