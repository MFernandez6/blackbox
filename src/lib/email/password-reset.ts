const DEFAULT_FROM = "Blackline Public Adjusters <noreply@blacklinepublicadjusters.com>";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<"sent" | "unconfigured" | "failed"> {
  const relay = process.env.RESET_MAIL_URL?.trim();
  const relaySecret = process.env.RESET_MAIL_SECRET?.trim();
  if (relay && relaySecret) {
    try {
      const res = await fetch(relay, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${relaySecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, link }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 503) return "unconfigured";
      return res.ok ? "sent" : "failed";
    } catch {
      return "failed";
    }
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return "unconfigured";
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Reset your BLACKBOX password",
        text: [
          "A password reset was requested for your BLACKBOX staff account.",
          "",
          "This link expires in 30 minutes and works once:",
          link,
          "",
          "The same password signs you into Blackbox, Gate, Ledger, Letter, and Field.",
          "If you did not request this, ignore this email. Your password will not change.",
        ].join("\n"),
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#1c1915;">
<p>A password reset was requested for your BLACKBOX staff account.</p>
<p><a href="${escapeHtml(link)}">Reset your password</a></p>
<p>This link expires in 30 minutes and works once. The same password signs you into Blackbox, Gate, Ledger, Letter, and Field.</p>
<p>If you did not request this, ignore this email. Your password will not change.</p>
</div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
