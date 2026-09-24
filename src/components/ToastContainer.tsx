import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoCircleIcon } from './icons'
import { dismissToast, useToasts, type ToastKind } from '../data/toast'

const kindStyles: Record<ToastKind, { bg: string; fg: string; icon: (color: string) => JSX.Element }> = {
  success: { bg: '#0f2d2b', fg: '#cce3e2', icon: (c) => <CheckCircleIcon color={c} /> },
  danger: { bg: '#3a1710', fg: '#ffdacc', icon: (c) => <AlertCircleIcon color={c} /> },
  info: { bg: '#171717', fg: '#fafafa', icon: (c) => <InfoCircleIcon color={c} /> },
}

export default function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const style = kindStyles[t.kind]
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: style.bg,
              color: style.fg,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
              maxWidth: 420,
            }}
          >
            {style.icon(style.fg)}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" style={{ display: 'flex', opacity: 0.7 }}>
              <CloseIcon size={12} color={style.fg} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
