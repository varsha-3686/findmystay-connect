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
- **Authentication → URL configuration:** include your app’s `/auth/callback` in redirect URLs.

### Test flows

1. **Email sign-up:** form → check-email screen → click Supabase confirm link → success screen on `/auth/callback` → welcome email → Continue → dashboard/owner portal.
2. **Mobile sign-up (no email):** OTP verify → registration success screen → no welcome email.
3. **Mobile sign-up (optional email):** OTP verify → success screen mentions welcome email → email received.
