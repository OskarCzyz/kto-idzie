import type { ReactNode } from 'react'
import logo from './assets/nyttars-logo.png'

/** Nyttårs camp 2026 banner: spotlight texture with the camp logo. */
export function Hero({ children }: { children?: ReactNode }) {
  return (
    <header className="hero">
      <img src={logo} alt="BUK Nyttårs camp 2026" className="hero-logo" />
      {children && <div className="hero-extra">{children}</div>}
    </header>
  )
}
