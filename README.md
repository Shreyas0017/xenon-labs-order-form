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
- `VITE_PAYMENT_UPI_ID` (UPI ID shown in payment instructions)
- `VITE_CLOUDINARY_CLOUD_NAME` (Cloudinary cloud name)
- `VITE_CLOUDINARY_UPLOAD_PRESET` (unsigned upload preset)
- `VITE_CLOUDINARY_FOLDER` (optional Cloudinary folder path)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Firestore Rules Setup

Payment submission writes update existing order documents. If Firestore rules do not allow owner updates for payment fields, you will get permission-denied errors.

Use the rules from [firestore.rules](firestore.rules).

What these rules allow:

- Authenticated users can create their own orders.
- Users can read only their own orders.
- Users can update only payment fields on their own order:
	- status to payment_submitted
	- payment
	- paymentSubmittedAt
- Admin email can read all orders and mark orders completed.

Deploy via Firebase CLI:

1. Install Firebase CLI: npm install -g firebase-tools
2. Login: firebase login
3. Select project: firebase use xenlabs-a3f42
4. Deploy rules file: firebase deploy --only firestore:rules

## Deployment Notes

- Never commit `.env`, `.env.local`, or any real secret values.
- Configure the same `VITE_*` variables in your deployment platform environment settings.
