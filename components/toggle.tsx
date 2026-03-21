type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
}

export const Toggle = ({ checked, onChange, ariaLabel }: ToggleProps) => {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-full border transition ${
        checked ? "border-cyan-500 bg-cyan-500" : "border-slate-300 bg-slate-300"
      }`}
      onClick={() => onChange(!checked)}
      type="button">
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </button>
  )
}
