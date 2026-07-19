import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  variant,
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...rest
}: { variant: Variant; size?: 'md' | 'sm'; fullWidth?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    fullWidth ? 'btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  // type defaults to "button": a stray <button> inside a <form> with type="submit"
  // (HTML's default) would submit the form unintentionally.
  return <button type={type} className={cls} {...rest} />
}
