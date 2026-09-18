import { redirect } from 'next/navigation'

export default function RenewalDocumentsPage() {
  redirect('/dashboard/company/action-center?state=expiring')
}
