import type { InputHTMLAttributes } from 'react'
import './ui.css'

export function TextInput({
  label,
  id,
  error,
  className = '',
  ...rest
}: { label: string; id: string; error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
