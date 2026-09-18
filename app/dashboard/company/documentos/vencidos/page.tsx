import { redirect } from 'next/navigation'

export default function ExpiredDocumentsPage() {
  redirect('/dashboard/company/action-center?state=expired')
}
