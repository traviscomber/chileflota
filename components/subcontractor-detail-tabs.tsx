'use client'

/**
 * ARCHITECTURE PATTERN - SubcontractorDetailTabs
 * 
 * This component displays 5 tabs with real data about a subcontractor.
 * Data flow follows a PARENT → CHILD pattern to ensure consistency:
 * 
 * 1. PARENT (SubcontractorsList) fetches:
 *    - conductoresData: drivers filtered by subcontractor RUT
 *    - documentsData: documents/requirements/summary from API
 * 
 * 2. PARENT passes data as PROPS to this component
 * 
 * 3. TABS use the REAL DATA:
 *    - Resumen: shows summary stats (totalDocumentsUploaded, approvedDocuments, etc.)
 *    - Documentos: maps requirements and shows which have documents uploaded
 *    - Conductores: displays driver list from conductoresData prop
 *    - Onboarding: checklist based on actual requirements/certifications/drivers
 *    - Certificaciones: shows certificates status
 * 
 * RULE: Never fetch data in the child component if parent can provide it.
 * This ensures single source of truth and prevents data mismatches.
 */

import { X, FileText, Award, AlertCircle, CheckCircle, Loader, Download, Eye, Users, CheckSquare, Mail, Phone, ChevronDown, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'
import { getOrVerifySIIStatus, getSIIStatusBadge, triggerSIIVerification, type DocumentSIIStatus } from '@/lib/sii-verification-helper'

interface SubcontractorDetailTabsProps {
  subcontractor: any
  initialTab?: 'resumen' | 'documentos' | 'conductores' | 'certificaciones' | 'onboarding'
  conductoresData?: any[]
  documentsData?: { documents: any[], requirements: any[], summary: any }
  onClose: () => void
}

export function SubcontractorDetailTabs({
  subcontractor,
  initialTab = 'resumen',
  conductoresData = [],
  documentsData,
  onClose,
}: SubcontractorDetailTabsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'resumen' | 'documentos' | 'conductores' | 'certificaciones' | 'onboarding'>('resumen')
  const [documents, setDocuments] = useState<any[]>([])
  const [requirements, setRequirements] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>(conductoresData)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set(['current']))
  const [siiVerificationStatus, setSiiVerificationStatus] = useState<DocumentSIIStatus | null>(null)
  const [siiLoading, setSiiLoading] = useState(false)
  const [summary, setSummary] = useState({
    totalDocumentsUploaded: 0,
    totalRequirements: 0,
    requirementsCovered: 0,
    requirementsMissing: 0,
    approvedRequirements: 0,
    approvedDocuments: 0,
    pendingDocuments: 0,
    expiredDocuments: 0,
    rejectedDocuments: 0,
  })

  const completion = (() => {
    const checks = [
      Boolean(subcontractor?.rut),
      Boolean(subcontractor?.nombre || subcontractor?.razon_social),
      Boolean(subcontractor?.representante_legal),
      Boolean(subcontractor?.telefono || subcontractor?.email || subcontractor?.correo),
      Boolean(subcontractor?.direccion || subcontractor?.comuna || subcontractor?.region),
      Boolean(subcontractor?.ejecutivo_nombre),
      Boolean(subcontractor?.ariztia || subcontractor?.lts || subcontractor?.rendic || subcontractor?.interpolar),
    ]

    const completed = checks.filter(Boolean).length
    const total = checks.length
    const percent = Math.round((completed / total) * 100)

    return {
      completed,
      total,
      percent,
      label: percent >= 90 ? 'Completo' : percent >= 60 ? 'Parcial' : 'Pendiente',
    }
  })()

  // Group documents by month (YYYY-MM format) for easier navigation
  const groupDocumentsByMonth = (docs: any[]) => {
    const grouped: { [key: string]: any[] } = {}
    
    docs.forEach((doc) => {
      if (doc.created_at) {
        const date = new Date(doc.created_at)
        const monthKey = date.toISOString().slice(0, 7) // YYYY-MM
        if (!grouped[monthKey]) {
          grouped[monthKey] = []
        }
        grouped[monthKey].push(doc)
      }
    })
    
    // Sort by month descending (newest first)
    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .map(([month, docs]) => ({
        month,
        monthLabel: new Date(month + '-01').toLocaleDateString('es-CL', { year: 'numeric', month: 'long' }),
        documentCount: docs.length,
        stats: {
          approved: docs.filter((d) => d.status === 'approved').length,
          pending: docs.filter((d) => d.status === 'pending').length,
          rejected: docs.filter((d) => d.status === 'rejected').length,
          expired: docs.filter((d) => d.status === 'expired').length,
        },
        docs: docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }))
  }

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
  }

  // Expand the most recent month by default once documents are loaded
  useEffect(() => {
    if (documents.length > 0) {
      const months = groupDocumentsByMonth(documents)
      if (months.length > 0) {
        setExpandedMonths((prev) => {
          // Only auto-expand if user hasn't interacted yet (still has placeholder)
          if (prev.has('current') || prev.size === 0) {
            return new Set([months[0].month])
          }
          return prev
        })
      }
    }
  }, [documents])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If documentsData is provided as prop, use it (pre-fetched from parent)
        if (documentsData) {
          setDocuments(documentsData.documents || [])
          setRequirements(documentsData.requirements || [])
          setSummary(documentsData.summary || summary)
        } else {
          // Otherwise fetch from API (fallback)
          const docResponse = await fetch(`/api/subcontractors/${subcontractor.id}/documents`)
          if (docResponse.ok) {
            const data = await docResponse.json()
            setDocuments(data.documents || [])
            setRequirements(data.requirements || [])
            setSummary(data.summary || summary)
          }
        }

        // Conductors are passed as a prop from subcontractors-list, no need to fetch
        // Use the conductoresData that's already been filtered by RUT matching
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (subcontractor.id) {
      fetchData()
      
      // Load SII verification status
      if (subcontractor.rut) {
        loadSIIStatus()
      }
    }
  }, [subcontractor.id, documentsData])

  const loadSIIStatus = async () => {
    if (!subcontractor.id || !subcontractor.rut) return

    setSiiLoading(true)
    try {
      const status = await getOrVerifySIIStatus(subcontractor.id, subcontractor.rut)
      setSiiVerificationStatus(status)

      // If no prior run exists, trigger one and then re-fetch the result
      if (status.status === 'pending') {
        await triggerSIIVerification(subcontractor.id, subcontractor.rut)
        // After trigger completes (engine ran synchronously), re-fetch status
        const updated = await getOrVerifySIIStatus(subcontractor.id, subcontractor.rut)
        setSiiVerificationStatus(updated)
      }
    } catch (error) {
      console.error('[v0] Error loading SII status:', error)
    } finally {
      setSiiLoading(false)
    }
  }

  const handleRefreshData = async () => {
    const docResponse = await fetch(`/api/subcontractors/${subcontractor.id}/documents`)
    if (docResponse.ok) {
      const data = await docResponse.json()
      setDocuments(data.documents || [])
      setRequirements(data.requirements || [])
      setSummary(data.summary || summary)
    }
  }

  const certifications = [
    { name: 'ARIZTIA', key: 'has_ariztia' },
    { name: 'LTS', key: 'has_lts' },
    { name: 'RENDIC', key: 'has_rendic' },
    { name: 'INTERPOLAR', key: 'has_interpolar' },
  ]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-slate-800/80 bg-slate-950/95 shadow-2xl shadow-slate-950/20">
          {/* Header */}
          <CardHeader className="sticky top-0 z-10 flex flex-col gap-4 border-b border-white/5 bg-gradient-to-r from-slate-950/95 via-slate-950/90 to-slate-900/95 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-200">
                Detalle ejecutivo
              </div>
              <CardTitle className="text-2xl text-white">
                {subcontractor.nombre}
              </CardTitle>
              {subcontractor.nombre_fantasia && (
                <p className="text-sm text-slate-400 italic">
                  {subcontractor.nombre_fantasia}
                </p>
              )}
              <div className="flex gap-2 items-center flex-wrap">
                {subcontractor.is_active ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <Badge className="bg-green-500/20 text-green-300">Activo</Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <Badge className="bg-red-500/20 text-red-300">Inactivo</Badge>
                  </>
                )}
                <Badge
                  variant="outline"
                  className={
                    completion.label === 'Completo'
                      ? 'border-emerald-200/40 bg-emerald-500/10 text-emerald-200'
                      : completion.label === 'Parcial'
                        ? 'border-amber-200/40 bg-amber-500/10 text-amber-200'
                        : 'border-rose-200/40 bg-rose-500/10 text-rose-200'
                  }
                >
                  Perfil {completion.percent}%
                </Badge>
                
                {/* SII Verification Badge */}
                {siiVerificationStatus && (
                  <Badge
                    variant="outline"
                    className={`border ${getSIIStatusBadge(siiVerificationStatus.status).color}`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {siiLoading ? '◌' : getSIIStatusBadge(siiVerificationStatus.status).icon} {getSIIStatusBadge(siiVerificationStatus.status).label}
                  </Badge>
                )}
                
                <Badge
                  variant="outline"
                  className={
                    completion.label === 'Completo'
                      ? 'border-emerald-200/40 bg-emerald-500/10 text-emerald-200'
                      : completion.label === 'Parcial'
                        ? 'border-amber-200/40 bg-amber-500/10 text-amber-200'
                        : 'border-rose-200/40 bg-rose-500/10 text-rose-200'
                  }
                >
                  {completion.label}
                </Badge>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </CardHeader>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={(value: any) => setSelectedTab(value)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start gap-2 rounded-none border-b border-slate-700 bg-slate-900/70 px-6 py-2 h-auto">
              <TabsTrigger value="resumen" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="documentos" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                Documentos ({summary.totalDocumentsUploaded})
              </TabsTrigger>
              <TabsTrigger value="certificaciones" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                Certificaciones
              </TabsTrigger>
              <TabsTrigger value="conductores" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                Conductores ({conductores.length})
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                Onboarding
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="overflow-y-auto flex-1">
              <CardContent className="p-6 space-y-6">
                {/* RESUMEN TAB */}
                <TabsContent value="resumen" className="space-y-6 mt-0">
                  {/* Company Info Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">RUT</p>
                      <p className="font-mono text-amber-400 font-bold">{subcontractor.rut}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">COMUNA</p>
                      <p className="text-white">{subcontractor.comuna || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 font-semibold mb-1">DIRECCIÓN</p>
                      <p className="text-white">{subcontractor.direccion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">REPRESENTANTE LEGAL</p>
                      <p className="text-white">{subcontractor.representante_legal || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">COMPLETITUD</p>
                      <p className="text-white">{completion.completed}/{completion.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">EJECUTIVA ASIGNADA</p>
                      <p className="text-white">{subcontractor.ejecutivo_nombre || 'Sin asignar'}</p>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div className="border-t border-slate-700 pt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      Contacto Directo
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold mb-1">TELÉFONO</p>
                        {subcontractor.telefono ? (
                          <a href={`tel:${subcontractor.telefono}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {subcontractor.telefono}
                          </a>
                        ) : (
                          <p className="text-slate-500">No disponible</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-semibold mb-1">EMAIL</p>
                        {subcontractor.email || subcontractor.correo ? (
                          <a href={`mailto:${subcontractor.email || subcontractor.correo}`} className="text-blue-400 hover:text-blue-300 text-sm">
                            {subcontractor.email || subcontractor.correo}
                          </a>
                        ) : (
                          <p className="text-slate-500">No disponible</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compliance Status */}
                  <div className="border-t border-slate-700 pt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                      Estado documental
                    </h3>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-center">
                        <p className="text-lg font-bold text-white">{summary.totalRequirements}</p>
                        <p className="text-xs text-slate-400">Requeridos</p>
                      </div>
                      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-center">
                        <p className="text-lg font-bold text-blue-300">{summary.requirementsCovered}</p>
                        <p className="text-xs text-blue-400">Requisitos con evidencia</p>
                      </div>
                      <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-center">
                        <p className="text-lg font-bold text-green-300">{summary.approvedDocuments}</p>
                        <p className="text-xs text-green-400">Aprobados</p>
                      </div>
                      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-center">
                        <p className="text-lg font-bold text-yellow-300">{summary.pendingDocuments}</p>
                        <p className="text-xs text-yellow-400">Pendientes</p>
                      </div>
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-center">
                        <p className="text-lg font-bold text-red-300">{summary.expiredDocuments}</p>
                        <p className="text-xs text-red-400">Vencidos</p>
                      </div>
                    </div>

                    {/* Compliance Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">Progreso General</span>
                        <span className="text-sm font-bold text-white">
                          {summary.totalRequirements > 0 
                            ? Math.round((summary.approvedDocuments / summary.totalRequirements) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-400 h-full rounded-full transition-all"
                          style={{ width: `${summary.totalRequirements > 0 ? Math.min((summary.approvedRequirements / summary.totalRequirements) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* DOCUMENTOS TAB */}
                <TabsContent value="documentos" className="space-y-4 mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                      <span className="text-sm text-slate-400">Cargando documentos...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Summary Stats */}
                      {requirements.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/20 sm:grid-cols-2">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-400">{summary.totalDocumentsUploaded}</p>
                            <p className="text-xs text-slate-400">Documentos Subidos</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-slate-400">{summary.requirementsMissing}</p>
                            <p className="text-xs text-slate-400">Requisitos sin evidencia</p>
                          </div>
                        </div>
                      )}
                      
                      {requirements.length > 0 ? (
                        <div className="space-y-4">
                          {/* Group documents by month for easier navigation */}
                          {(() => {
                            const monthGroups = groupDocumentsByMonth(documents)
                            const statusColors: Record<string, string> = {
                              approved: 'bg-green-900/20 border-green-800 text-green-400',
                              pending: 'bg-yellow-900/20 border-yellow-800 text-yellow-400',
                              rejected: 'bg-red-900/20 border-red-800 text-red-400',
                              expired: 'bg-orange-900/20 border-orange-800 text-orange-400',
                            }
                            const statusLabel: Record<string, string> = {
                              approved: 'Aprobado',
                              pending: 'Pendiente',
                              rejected: 'Rechazado',
                              expired: 'Vencido',
                            }
                            
                            return (
                              <>
                                {/* Show all requirements organized by month uploaded */}
                                {monthGroups.length > 0 ? (
                                  monthGroups.map((monthGroup) => {
                                    const isExpanded = expandedMonths.has(monthGroup.month)
                                    const docsInMonth = monthGroup.docs.length
                                    
                                    return (
                                      <div key={monthGroup.month} className="border border-slate-700 rounded overflow-hidden">
                                        {/* Month Header */}
                                        <button
                                          onClick={() => toggleMonth(monthGroup.month)}
                                          className="flex w-full items-center justify-between bg-slate-800/50 px-4 py-3 transition-colors hover:bg-slate-800"
                                        >
                                          <div className="flex items-center gap-3">
                                            <ChevronDown 
                                              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                            <span className="text-sm font-semibold text-slate-200 capitalize">{monthGroup.monthLabel}</span>
                                            <Badge variant="outline" className="text-xs">{docsInMonth} documentos</Badge>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            {monthGroup.stats.approved > 0 && (
                                              <Badge className="bg-green-500/20 text-green-300 text-xs">{monthGroup.stats.approved} aprob.</Badge>
                                            )}
                                            {monthGroup.stats.pending > 0 && (
                                              <Badge className="bg-yellow-500/20 text-yellow-300 text-xs">{monthGroup.stats.pending} pend.</Badge>
                                            )}
                                            {monthGroup.stats.rejected > 0 && (
                                              <Badge className="bg-red-500/20 text-red-300 text-xs">{monthGroup.stats.rejected} rech.</Badge>
                                            )}
                                            {monthGroup.stats.expired > 0 && (
                                              <Badge className="bg-orange-500/20 text-orange-300 text-xs">{monthGroup.stats.expired} venc.</Badge>
                                            )}
                                          </div>
                                        </button>
                                        
                                        {/* Month Content */}
                                        {isExpanded && (
                                          <div className="space-y-3 border-t border-slate-700 bg-slate-900/30 px-4 py-3">
                                            {monthGroup.docs.map((doc) => {
                                              const requirement = requirements.find(r => r.id === doc.document_type_id)
                                              const docType = requirement || doc.document_type || {
                                                id: doc.document_type_id,
                                                code: 'DOCUMENTO',
                                                nombre: 'Documento adicional',
                                              }
                                              
                                              const docStatus = doc.status || 'not_uploaded'
                                              const statusColor = statusColors[docStatus] || 'bg-slate-800 text-slate-400'
                                              const displayStatus = statusLabel[docStatus as keyof typeof statusLabel] || docStatus
                                              
                                              return (
                                                <div
                                                  key={doc.id}
                                                  className={`flex items-center justify-between rounded-2xl border p-4 transition-all hover:shadow-md ${statusColor}`}
                                                >
                                                  <div className="flex-1 flex items-start gap-3">
                                                    <div className="mt-1">
                                                      {doc.file_url ? (
                                                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                      ) : (
                                                        <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                                      )}
                                                    </div>
                                                    
                                                    <div className="flex-1">
                                                      <p className="font-mono text-xs font-bold">{docType.code}</p>
                                                      <p className="text-sm">{docType.nombre || 'Documento'}</p>
                                                      {doc.file_name && (
                                                        <p className="text-xs text-slate-300 mt-1">
                                                          📄 {doc.file_name}
                                                        </p>
                                                      )}
                                                      <p className="text-xs text-slate-500 mt-1">
                                                        {new Date(doc.created_at).toLocaleDateString('es-CL')}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-3 ml-4">
                                                    <span className="text-xs font-semibold whitespace-nowrap">{displayStatus}</span>
                                                    {doc.file_url && (
                                                      <div className="flex gap-2">
                                                        <a
                                                          href={buildDocumentAccessUrl(doc.file_url, 'preview')}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="hover:opacity-75 transition-opacity text-blue-400 hover:text-blue-300"
                                                          title="Ver documento"
                                                        >
                                                          <Eye className="w-4 h-4" />
                                                        </a>
                                                        <a
                                                          href={buildDocumentAccessUrl(doc.file_url, 'download')}
                                                          className="hover:opacity-75 transition-opacity text-blue-400 hover:text-blue-300"
                                                          title="Descargar"
                                                        >
                                                          <Download className="w-4 h-4" />
                                                        </a>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-sm text-slate-400 text-center py-8">No hay documentos subidos</p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-8">No hay requisitos disponibles</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* CERTIFICACIONES TAB */}
                <TabsContent value="certificaciones" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {certifications.map((cert) => {
                      const hasCert = subcontractor[cert.key];
                      const certDoc = documents.find((d) => d.nombre?.includes(cert.name ?? ''));
                      
                      return (
                        <div key={cert.key} className="space-y-2">
                          <div className={`rounded-2xl border-2 p-4 transition-all ${
                            hasCert
                              ? certDoc 
                                ? 'bg-green-900/30 border-green-600'
                                : 'bg-yellow-900/30 border-yellow-600'
                              : 'bg-slate-800/30 border-slate-700 opacity-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-white">{cert.name}</p>
                              <div className="text-lg">
                                {!hasCert ? '✗' : certDoc ? '✓' : '⚠'}
                              </div>
                            </div>
                            <p className="text-xs text-slate-300">
                              {!hasCert 
                                ? 'No registrada'
                                : certDoc
                                ? 'Con documento'
                                : 'Registrada sin documento'
                              }
                            </p>
                          </div>
                          {hasCert && certDoc && certDoc.archivo_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => window.open(buildDocumentAccessUrl(certDoc.archivo_url, 'preview'), '_blank')}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Ver Documento
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                {/* CONDUCTORES TAB */}
                <TabsContent value="conductores" className="space-y-4 mt-0">
                  {conductores.length > 0 ? (
                    <div className="space-y-3">
                      {conductores.map((conductor) => (
                        <div key={conductor.id} className="p-4 rounded border border-slate-700 bg-slate-800/30">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-white">{conductor.nombre}</p>
                              <p className="text-xs text-slate-400 mb-2">RUT: <span className="font-mono text-amber-400">{conductor.rut?.replace(/\./g, '')}</span></p>
                              
                              {conductor.is_active && (
                                <Badge className="bg-green-500/20 text-green-300 text-xs">Activo</Badge>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                // Navigate to conductores page to show this conductor
                                onClose()
                                router.push(`/dashboard/company/conductores?rut=${conductor.rut.replace(/\./g, '')}`)
                              }}
                            >
                              Ver Ficha
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-8">Sin conductores asociados</p>
                  )}
                </TabsContent>

                {/* ONBOARDING TAB */}
                <TabsContent value="onboarding" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300 mb-4">
                      Lista de verificación para activación de nuevo subcontratista
                    </p>
                    
                    <div className="space-y-2">
                      {[
                        { label: 'Documentos EMPRESA completados', status: requirements.filter(r => r.category === 'Empresa').some(r => r.status === 'aprobado') },
                        { label: 'Documentos SUBCONTRATACIÓN completados', status: requirements.filter(r => r.category === 'Subcontratación').some(r => r.status === 'aprobado') },
                        { label: 'Certificaciones registradas', status: certifications.some(c => subcontractor[c.key]) },
                        { label: 'Conductores asignados', status: conductores.length > 0 },
                        { label: 'Contacto verificado', status: !!subcontractor.telefono && !!subcontractor.email },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded border border-slate-700">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            item.status 
                              ? 'bg-green-500/20 border-green-600'
                              : 'bg-slate-800 border-slate-600'
                          }`}>
                            {item.status && <CheckCircle className="w-3 h-3 text-green-400" />}
                          </div>
                          <span className={item.status ? 'text-green-400 text-sm' : 'text-slate-400 text-sm'}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-700 pt-4 mt-4">
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          // Send onboarding email/invite
                        }}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Instrucciones de Onboarding
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </>
  )
}
