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
  // type mặc định "button": một <button> lạc trong <form> mà type="submit"
  // (mặc định của HTML) sẽ submit form ngoài ý muốn.
  return <button type={type} className={cls} {...rest} />
}
