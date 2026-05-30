# FindMyStay

## Registration welcome email (Resend)

After a user completes registration, the `complete-registration` edge function sends a custom welcome email via [Resend](https://resend.com). Supabase still sends its own email confirmation link for email sign-up; this welcome email is in addition to that.

### Supabase Edge Function secrets

In **Supabase Dashboard → Edge Functions → Secrets**, set:

| Secret | Required | Description |
|--------|----------|-------------|
| `RESEND_API_KEY` | Yes (for welcome email) | API key from Resend |
| `WELCOME_EMAIL_FROM` | No | Sender, e.g. `StayNest <onboarding@yourdomain.com>` (must use a verified Resend domain). Defaults to `StayNest <onboarding@resend.dev>` for testing |
| `APP_URL` | No | Link in the welcome email body. Defaults to `https://staynest.app` |

If `RESEND_API_KEY` is missing, registration still succeeds; the UI shows `welcomeEmailSent: false`.

### Deploy

Redeploy the edge function after setting secrets:

```bash
supabase functions deploy complete-registration
```

### Auth settings

- **Authentication → Email provider:** keep **Confirm email** enabled for email sign-up.
- **Authentication → URL configuration:** set Site URL to your production origin and add redirect URLs:
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/auth/callback?type=recovery`
  - Include localhost URLs for local dev (e.g. `http://localhost:8080/auth/callback`)
- **Authentication → Email → SMTP (optional):** configure custom SMTP for reliable signup confirmation and password-reset emails.
- Email templates should use `{{ .ConfirmationURL }}` (signup) and `{{ .ConfirmationURL }}` (recovery) so links return to `/auth/callback`.

### Forgot password and signup confirmation

The app uses PKCE auth flow. Password reset and signup confirmation links land on `/auth/callback`, which exchanges the `code` or waits for the session before continuing.

**Test forgot password:** Login (email) → Forgot password → click reset link → set new password on callback page.

**Test signup confirmation:** Sign up with email → check inbox → click confirm link → registration success screen. Use **Resend email** on the check-email screen if needed (uses `auth.resend`, not a second sign-up).

## Admin referrals and wallets

Run in **Supabase SQL Editor**:

- `supabase/migrations/20260430100000_admin_referrals_wallet_read.sql` — lets admins read all referral rows and wallet balances

Then open **Admin → Referrals & Wallets** to view referral workflow status and referrer wallet amounts.

### Test flows

1. **Email sign-up:** form → check-email screen → click Supabase confirm link → success screen on `/auth/callback` → welcome email → Continue → dashboard/owner portal.
2. **Mobile sign-up (no email):** OTP verify → registration success screen → no welcome email.
3. **Mobile sign-up (optional email):** OTP verify → success screen mentions welcome email → email received.

## Referral reward on check-in

The referrer (code owner) receives ₹100 when a referred friend is **checked in** to their hostel booking.

### Database

Run in **Supabase SQL Editor** (project `anjmawtmkbjneplprinv`):

1. `supabase/migrations/20260429000000_referral_booking_reward.sql` (if not applied yet)
2. `supabase/migrations/20260429100000_referral_referrer_checkin_reward.sql` — replaces reward logic to credit `referrer_user_id` on `checked_in` and backfills missed pending referrals

The second migration ends with `NOTIFY pgrst, 'reload schema';`.

### Edge function

```bash
supabase functions deploy apply-referral-code
```

### Test flow

1. User A shares referral code → User B signs up with code → referral row `status = pending`
2. User B books → owner approves → **referrer wallet unchanged**
3. Owner checks in User B → User A wallet +₹100, referral `status = rewarded`
4. Second check-in or booking → no duplicate credit
