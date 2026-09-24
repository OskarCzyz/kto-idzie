// Minimal typing of the Telegram WebApp object we use (loaded by telegram-web-app.js in index.html).
interface TelegramWebApp {
  initData: string
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  showConfirm?(message: string, callback: (ok: boolean) => void): void
  HapticFeedback?: { selectionChanged(): void }
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const tg: TelegramWebApp | undefined = window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : undefined

export function initTelegram() {
  if (!tg) return
  tg.ready()
  tg.expand()
  tg.disableVerticalSwipes?.() // otherwise dragging in the ranking closes the Mini App
}

/** Telegram's native confirm when available, browser confirm otherwise. */
export function confirmAsync(message: string): Promise<boolean> {
  if (tg?.showConfirm) return new Promise((resolve) => tg.showConfirm!(message, resolve))
  return Promise.resolve(window.confirm(message))
}
