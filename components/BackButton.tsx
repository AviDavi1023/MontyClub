"use client"

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'

export default function BackButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => window.history.back()}
      icon={<ArrowLeft className="h-4 w-4" />}
    >
      Go Back
    </Button>
  )
}
