import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { OperationalActionCenter } from '@/components/dashboard/operational-action-center'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardOverview />
      <OperationalActionCenter compact />
    </div>
  )
}
