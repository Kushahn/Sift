# Android build & `native-reminder-sync` verification

The web app and `syncReminders()` (`src/lib/notify.js`) are done. The Android
native project is scaffolded under `android/`. Everything below needs real
hardware/SDK that the dev box doesn't have — it's the one remaining step to flip
`native-reminder-sync` to `passes:true`.

## One-time prerequisites
- **JDK 17** (Capacitor 6 requires it) and **Android Studio** (bundles the SDK + an emulator), or a physical Android device with USB debugging on.
- `ANDROID_HOME` / `JAVA_HOME` set so Gradle can find them.

## Build & run
```powershell
cd sift
npm run android      # = vite build + cap sync android + cap open android
```
`cap open android` launches Android Studio. Press **Run ▶** to deploy to the
connected device/emulator. (Headless alternative: `cd android; ./gradlew installDebug`.)

## First launch
1. App asks for the **notifications** permission (`POST_NOTIFICATIONS`, Android 13+) — allow it.
2. Grant **Alarms & reminders** for Sift: Settings → Apps → Sift → "Alarms & reminders".
   Required for `SCHEDULE_EXACT_ALARM` so reminders fire on time, not batched.
   (Or swap the manifest to `USE_EXACT_ALARM` for a no-prompt personal build — see the comment in `AndroidManifest.xml`.)

## Verify the feature (ledger steps for `native-reminder-sync`)
The sync model is **cancel-all-then-reschedule** on every item change, so the OS's
pending set should always equal the app's current future reminders.

1. **Add** an item with a due date/time ~1–2 min out and remind on → wait → a "Sift" notification fires with the item text.
2. **Edit** that item's time → only the new time should be pending (old one cancelled).
3. **Remove** / mark done / clear the reminder → no notification fires.
4. Inspect the pending set at any point to confirm it matches the app:
   ```js
   // run in the WebView console (chrome://inspect → inspect the device)
   const { LocalNotifications } = await import('@capacitor/local-notifications');
   console.log((await LocalNotifications.getPending()).notifications);
   ```
   The ids are `numericId(item.id)` and there should be exactly one per
   future, undone, non-vague, remind=true item — no stale entries.

When 1–4 hold, hand-edit `features.json` → `native-reminder-sync` → `passes:true`
(never via shell; the `$1` expansion corrupts the JSON).

## Notes
- After any web change: `npm run build && npx cap sync android` to push assets into the native shell.
- `android/` build artifacts (`build/`, `.gradle/`) are gitignored by Capacitor's generated `android/.gitignore`; the project itself is meant to be committed.
