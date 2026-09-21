export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { DocumentManagerHub } from '@/components/document-manager-hub'

const EMPTY_STATS = {
  conductores: {
    total: 0,
    processed: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
    vencidos: 0,
  },
  subcontratistas: {
    total: 0,
    processed: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
    vencidos: 0,
  },
  lifetime: {
    registered: 0,
    processed: 0,
    awaitingProcessing: 0,
    globalProcessed: 0,
  },
  certificaciones: {
    total: 0,
    vigentes: 0,
    porVencer: 0,
    vencidas: 0,
  },
}

export default function DocumentosPage() {
  return <DocumentManagerHub stats={EMPTY_STATS} />
}
