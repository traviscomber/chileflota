import { OperationalActionCenter } from '@/components/dashboard/operational-action-center'

export const metadata = {
  title: 'Centro de Acción | ChileFlota',
  description: 'Cola operacional priorizada por vencimientos, rechazos y revisiones pendientes.',
}

export default function ActionCenterPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="border-b border-[#303238] pb-5 text-[#F2F0EB]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#A9ADB3]">Control operacional</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">Centro de Acción</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#A9ADB3]">
          Una sola cola para resolver vencimientos, rechazos, revisiones y renovaciones antes de que afecten la operación.
        </p>
      </header>

      <OperationalActionCenter />
    </div>
  )
}
