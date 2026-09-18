import { redirect } from 'next/navigation'

export default function LegacyExecutiveDashboardRedirect() {
  redirect('/dashboard/company/documentos/pendientes')
}
