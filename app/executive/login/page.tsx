import { redirect } from 'next/navigation'

export default function LegacyExecutiveLoginRedirect() {
  redirect('/login')
}
