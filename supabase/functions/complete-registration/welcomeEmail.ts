export async function sendWelcomeEmail(options: {
  to: string;
  fullName: string;
  role: "user" | "owner";
  appUrl: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set; skipping welcome email");
    return false;
  }

  const from =
    Deno.env.get("WELCOME_EMAIL_FROM") ?? "StayNest <onboarding@resend.dev>";

  const name = options.fullName.trim() || "there";
  const roleLine =
    options.role === "owner"
      ? "You can sign in to add your property and manage bookings."
      : "You can sign in to browse hostels and submit booking requests.";

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #2C2C2C;">
      <h1 style="color: #5A3E2B;">Welcome to StayNest</h1>
      <p>Hi ${name},</p>
      <p>Your registration is confirmed. ${roleLine}</p>
      <p><a href="${options.appUrl}" style="color: #5A3E2B;">Open StayNest</a></p>
      <p style="color: #6B6B6B; font-size: 14px;">If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: "Welcome to StayNest",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend welcome email failed:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Resend welcome email error:", err);
    return false;
  }
}
