'use client'

import { useState, useEffect } from 'react'

export function NotificationBell() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  async function subscribe() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    setLoading(true)

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        console.warn('VAPID public key not configured')
        return
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      // Save subscription to DB via API
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
    } catch (err) {
      console.error('Failed to subscribe to notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return
    setLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setPermission('default')
    } catch (err) {
      console.error('Failed to unsubscribe:', err)
    } finally {
      setLoading(false)
    }
  }

  const isGranted = permission === 'granted'

  return (
    <button
      onClick={isGranted ? unsubscribe : subscribe}
      disabled={loading || permission === 'denied'}
      title={
        permission === 'denied'
          ? 'Notifications blocked — check browser settings'
          : isGranted
          ? 'Disable push notifications'
          : 'Enable push notifications for score 9+ opportunities'
      }
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isGranted
          ? 'border-red-500/35 bg-red-950/40 text-red-300 hover:bg-red-950/60'
          : permission === 'denied'
            ? 'cursor-not-allowed border-white/10 bg-zinc-950 text-zinc-600'
            : 'border-white/15 bg-zinc-950 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
      }`}
    >
      <span>{isGranted ? '🔔' : '🔕'}</span>
      <span className="hidden sm:inline">
        {loading ? 'Loading…' : isGranted ? 'Alerts on' : 'Alerts off'}
      </span>
    </button>
  )
}
