# Xenon Labs Order Form

## Environment Setup

This project is configured to read Firebase and admin settings only from environment variables.

1. Copy `.env.example` to `.env.local`.
2. Fill in your Firebase project values.
3. Set `VITE_ADMIN_EMAIL` to your admin Google account email.

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAIL`

Optional:

- `VITE_FIREBASE_MEASUREMENT_ID`

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment Notes

- Never commit `.env`, `.env.local`, or any real secret values.
- Configure the same `VITE_*` variables in your deployment platform environment settings.
