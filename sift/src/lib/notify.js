// Reminder scheduling. Native Android (Capacitor) gets real OS-scheduled
// notifications that fire with the app closed. Web gets best-effort
// notifications while Sift is open — the web platform cannot fire scheduled
// notifications from a fully closed page without a push server.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = Capacitor.isNativePlatform();

// When this item's reminder should fire (epoch ms), or null if no reminder
// applies. May be in the past — callers decide what past means.
export function reminderTime(item) {
  if (!item.remind || item.done || item.vague || item.due == null) return null;
  if (item.hasTime) return item.due;
  const d = new Date(item.due);
  d.setHours(9, 0, 0, 0); // date-only items remind at 09:00 that day
  return d.getTime();
}

// Stable positive int32 id for Capacitor from the string item id.
function numericId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2147483646 + 1;
}

export async function ensurePermission() {
  try {
    if (isNative) {
      const r = await LocalNotifications.requestPermissions();
      return r.display === "granted";
    }
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

// Web: fire a notification right now. Android Chrome forbids `new Notification()`
// from a page (it throws — notifications must go through the service worker),
// so prefer the SW path and fall back to the constructor.
export async function showNotification(title, opts) {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) return await reg.showNotification(title, opts);
  } catch { /* fall through to the constructor */ }
  try { new Notification(title, opts); } catch { /* nothing else to try */ }
}

// Native only: cancel everything pending and reschedule all future reminders.
// Called whenever items change — idempotent by construction.
export async function syncReminders(items) {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const now = Date.now();
    const notifications = items
      .map((it) => ({ it, at: reminderTime(it) }))
      .filter((x) => x.at != null && x.at > now)
      .map(({ it, at }) => ({
        id: numericId(it.id),
        title: "Sift",
        body: it.text,
        schedule: { at: new Date(at) },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch { /* notifications unavailable — app works without them */ }
}
