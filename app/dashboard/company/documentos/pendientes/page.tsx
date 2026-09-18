'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PendingDocumentsList } from '@/components/pending-documents-list'

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRut(value: unknown) {
  return normalizeText(value).replace(/[^0-9k]/g, '')
}

function matchesSearch(doc: any, rawQuery: string) {
  if (!rawQuery) return true

  const query = normalizeText(rawQuery)
  const queryRut = normalizeRut(rawQuery)
  const transportista = Array.isArray(doc?.transportistas) ? doc.transportistas[0] : doc?.transportistas
  const conductor = Array.isArray(doc?.conductores) ? doc.conductores[0] : doc?.conductores

  const text = normalizeText([
    doc?.original_filename,
    doc?.file_name,
    doc?.empresa_nombre,
    doc?.subcontractor_rut,
    transportista?.razon_social,
    transportista?.nombre_fantasia,
    transportista?.rut,
    conductor?.nombres,
    conductor?.apellido_paterno,
    conductor?.rut,
    doc?.docType?.nombre,
    doc?.docType?.code,
  ].filter(Boolean).join(' '))

  if (query && text.includes(query)) return true
  if (!queryRut) return false

  return [doc?.subcontractor_rut, transportista?.rut, conductor?.rut]
    .map(normalizeRut)
    .filter(Boolean)
    .some((rut) => rut.includes(queryRut))
}

export default function PendientesPage() {
  const searchParams = useSearchParams()
  const [allData, setAllData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const search = searchParams.get('search')?.trim() || ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const focusMode = searchParams.get('focus_mode')
        const focusId = searchParams.get('focus_id')
        const query = new URLSearchParams()
        if (focusMode) query.set('focus_mode', focusMode)
        if (focusId) query.set('focus_id', focusId)

        const response = await fetch(`/api/dashboard/pending-documents${query.size ? `?${query.toString()}` : ''}`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Pending documents ${response.status}`)
        const data = await response.json()
        setAllData(data)
      } catch (error) {
        console.error('[v0] Error fetching pending documents:', error)
        setAllData({ conductorDocs: [], subDocs: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [searchParams])

  const filteredData = useMemo(() => {
    const conductorDocs = allData?.conductorDocs || []
    const subDocs = allData?.subDocs || []
    if (!search) return { conductorDocs, subDocs }

    return {
      conductorDocs: conductorDocs.filter((doc: any) => matchesSearch(doc, search)),
      subDocs: subDocs.filter((doc: any) => matchesSearch(doc, search)),
    }
  }, [allData, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
          <p className="text-slate-400">Cargando documentos...</p>
        </div>
      </div>
    )
  }

  return (
    <PendingDocumentsList
      conductorDocs={filteredData.conductorDocs}
      subDocs={filteredData.subDocs}
    />
  )
}
