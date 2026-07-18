import type { HTMLAttributes } from 'react'
import './ui.css'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest} />
}
