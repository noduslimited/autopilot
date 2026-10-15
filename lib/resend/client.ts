// First real application use of Resend (previously only configured as
// Supabase Auth's SMTP relay, never called directly by app code). Source:
// TRD section 3 (Resend as transactional email provider). No PDF
// generation library exists anywhere in this project — the Reports page
// (PRD 4.8) explicitly uses the browser's own print API for PDF output
// rather than a server-side library, so "emails PDF" for invoices is
// implemented the same way: a well-formatted HTML email, not a literal
// PDF attachment. Sending a real PDF attachment would require adding a
// new server-side PDF-generation dependency not part of the confirmed
// tech stack.
const FROM_ADDRESS = "Autopilot <support@noduslimited.co.uk>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Graceful failure — returns false rather than throwing, so callers can
// surface a clear error to the manager without an unhandled exception.
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("sendEmail: RESEND_API_KEY not configured");
    return false;
  }

  // Resend's free tier allows ~2 requests/second; notifyAndMaybeEmail sends
  // to every manager in parallel, so a 429 (or a transient 5xx/network
  // error) is retried with backoff instead of the email being silently
  // dropped (an incident email went missing in testing, 2026-10-15).
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
      });

      if (response.ok) return true;
      const retryable = response.status === 429 || response.status >= 500;
      console.error(`sendEmail: Resend API error (attempt ${attempt})`, response.status, await response.text().catch(() => ""));
      if (!retryable) return false;
    } catch (error) {
      console.error(`sendEmail: request failed (attempt ${attempt})`, error);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt));
  }
  return false;
}
