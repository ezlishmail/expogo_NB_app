# Northern Bloom — iOS app (SwiftUI)

Same REST API as the Android app; same white-label principle: the only
tenant-specific value compiled in is the API base URL. Branding, feature
flags, catalog, and content all come from `GET /config`.

## Requirements

- macOS with Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Build & run

```bash
cd ios
xcodegen                 # produces NorthernBloom.xcodeproj
open NorthernBloom.xcodeproj
# Choose a simulator and Cmd+R.
```

Point the app at your API:

- Simulator + local backend: default `http://localhost:3000/api/v1` works
  (ATS exception for `localhost` is already configured in project.yml).
- Production: set the `NB_API_URL` environment variable in the scheme
  (Product ▸ Scheme ▸ Edit Scheme ▸ Run ▸ Arguments), e.g.
  `https://nb-api.yourdomain.com/api/v1`.

## What's implemented

- Login / register / session persistence
- Feature-flag-driven tabs (appointments/shopping on-off per tenant)
- Home: greeting, booking shortcut, featured products
- Shop: categories filter, product detail, client-side cart, checkout with
  pickup/delivery + coupon code (totals verified server-side)
- Booking flow: service → staff → date → live availability slots → confirm,
  plus "My appointments" list
- Orders: history + detail with server-computed totals breakdown
- Profile: marketing opt-in, sign out, account deletion (anonymization)
- Notifications: in-app inbox, mark-all-read
- Push: APNs registration, device token binding to POST /devices
- Deep links: `nbcustomer://open/product/{id}`, `/open/order/{id}`

## Push notes

The backend sends via FCM HTTP v1. For direct iOS delivery you can either:
1. Add an APNs key to Firebase and let FCM bridge delivery (recommended), or
2. Extend the backend to send to APNs directly — the devices table already
   stores platform tokens.

Until one of those is wired, iOS receives in-app notifications only.
