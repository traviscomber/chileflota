'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { RejectedDocumentsList } from '@/components/rejected-documents-list'

export default function RechazadosPage() {
  const [allData, setAllData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/company/documents/rechazados', {
          cache: 'no-store',
        })
        const data = await response.json()
        setAllData(data)
      } catch (error) {
        console.error('[v0] Error fetching rejected documents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => {}
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/company/documents/rechazados', {
        cache: 'no-store',
      })
      const data = await response.json()
      setAllData(data)
    } catch (error) {
      console.error('[v0] Error refreshing documents:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-[var(--cf-danger)] animate-spin" />
          <p className="text-[var(--cf-text-muted)]">Cargando documentos...</p>
        </div>
      </div>
    )
  }

  const totalRejected = (allData?.conductorDocs?.length || 0) + (allData?.subDocs?.length || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/company/documentos">
            <Button variant="ghost" size="sm" className="text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cf-text)]">Documentos Rechazados</h1>
            <p className="text-sm text-[var(--cf-text-muted)]">
              {totalRejected} documentos para revisar
            </p>
          </div>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-red-600 hover:bg-red-700 text-[var(--cf-text)]"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="rounded-[6px] border border-red-500/20 bg-red-500/5 p-4 text-sm text-[var(--cf-text-secondary)]">
        Filtra por ejecutiva, empresa, tipo de documento y período desde el listado.
      </div>

      <RejectedDocumentsList
        conductorDocs={allData?.conductorDocs || []}
        subDocs={allData?.subDocs || []}
      />
    </div>
  )
}
