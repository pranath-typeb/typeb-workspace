// Small switch used in settings-style rows. Knob colours follow the theme tokens.
export default function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 999,
        flexShrink: 0,
        background: checked ? 'var(--color-control-on)' : 'var(--color-border-default)',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: checked ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  )
}
