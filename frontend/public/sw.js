// SKYFORGE Service Worker — Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title:"SKYFORGE", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "SKYFORGE", {
      body:  data.body,
      icon:  data.icon  ?? "/icon-192.png",
      badge: data.badge ?? "/icon-72.png",
      tag:   data.tag   ?? "skyforge",
      data:  data.data  ?? {},
      requireInteraction: data.tag === "skyforge-threat",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/simulator";
  event.waitUntil(
    clients.matchAll({ type:"window" }).then(cs => {
      const c = cs.find(c => c.url.includes(url));
      return c ? c.focus() : clients.openWindow(url);
    })
  );
});
