// Custom Service Worker — handles push notifications from the app
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// Workbox injection point
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// ── Receive message from the app to show a notification ──────────────────────
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return
  const { title, body, icon } = event.data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   icon  || '/icons/icon-192.png',
      badge:  '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag:    'nifty-signal',        // replaces previous notification of same tag
      renotify: true,
    })
  )
})

// ── Clicking the notification opens / focuses the app ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
