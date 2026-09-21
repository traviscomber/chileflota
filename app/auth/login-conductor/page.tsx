// Server component — delegates entirely to a client-only dynamic import.
// No SSR output = no hydration diff = no NEXT_REDIRECT crash from password managers.
import dynamic from 'next/dynamic'

const ConductorLoginForm = dynamic(
  () => import('@/components/conductor/login-form'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: '100vh',
        background: 'var(--cf-canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        color: 'var(--cf-text-muted)',
        fontSize: '14px',
      }}>
        Cargando...
      </div>
    ),
  }
)

export default function ConductorLoginPage() {
  return <ConductorLoginForm />
}
