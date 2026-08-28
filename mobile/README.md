# Northern Bloom — Expo Go app (iOS + Android)

Testable on a **real iPhone or Android phone right now** via the Expo Go app —
no Mac, no Xcode, no Android Studio needed.

## Test it on your phone (5 minutes)

1. Install **Expo Go** from the App Store / Play Store.
2. Make sure your phone is on the **same WiFi** as this PC.
3. Keep the backend running here (`cd backend && npm run dev`).
4. In this folder:

```powershell
npm install
npx expo start
```

5. Scan the QR code shown in the terminal:
   - iPhone → Camera app
   - Android → "Scan QR code" button inside Expo Go

The app auto-discovers this PC's LAN IP for the API — zero configuration.
If you move networks, just shake the phone in Expo Go and reload.

> Production API later? Set `EXPO_PUBLIC_API_URL=https://your-api.com/api/v1`
> before `expo start` (or in an `.env` file here).

## What's inside

- Sign in / register, persistent session
- Home with greeting, gradient booking hero, featured carousel, store info card
- Shop: category chips, 2-column grid, product detail, cart badge
- Cart with steppers → checkout (pickup/delivery cards, address, coupon,
  server-computed totals)
- Booking flow: service → stylist → day strip → live time slots → success;
  plus My Bookings tab with cancel
- Orders list + detail with totals breakdown and status pills
- Notifications inbox with unread badges + mark-all-read
- Profile: marketing opt-in toggle, sign out, delete-account confirmation

Design system: warm-cream / ink / gold palette driven at runtime from the
tenant's `/config` brand colours (static theme is fallback only), Fraunces
display serif + Inter, soft shadows, haptic feedback on key actions, skeleton
loaders, feature-flag-driven tabs (same rules as the native apps).

## From Expo Go to the App Store / Play Store

No rewrite required — this same codebase ships to production:

```powershell
npx eas login            # free Expo account (eas-cli)
eas build -p ios         # compiles a signed IPA on Apple hardware in the cloud
eas build -p android     # AAB for Google Play
eas submit -p ios        # upload straight to TestFlight / App Store Connect
```

What you add at that point:
1. Apple Developer account ($99/yr) — required for TestFlight/App Store
2. App icon + splash images (`app.json`), store screenshots
3. Real push notifications: `expo-notifications` + EAS credentials (Expo Go
   itself can't receive pushes; production builds can)

That's the whole gap — the UI, flows, API layer and state carry over as-is.
