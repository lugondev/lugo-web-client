import type { TextareaHTMLAttributes } from 'react'
import './ui.css'

export function TextArea({
  label,
  id,
  error,
  className = '',
  ...rest
}: { label: string; id: string; error?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={`textarea ${className}`}
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
