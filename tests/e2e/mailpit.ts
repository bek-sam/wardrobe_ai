/**
 * Reads messages out of the local Mailpit/Inbucket instance that
 * `supabase start` runs, so the confirmation, recovery, and magic-link flows
 * can be driven end to end without a real SMTP provider.
 *
 * Local development only. Nothing here ships, and no production credential is
 * involved: Mailpit accepts every message and exposes them over plain HTTP on
 * a loopback port.
 */
const MAILPIT_URL = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitMessage = { ID: string; To: { Address: string }[]; Subject: string };

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  if (!response.ok) throw new Error(`Mailpit request failed: ${response.status}`);
  return (await response.json()) as T;
}

/** Polls until a message addressed to `email` appears, then returns its body. */
export async function waitForEmail(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { messages } = await json<{ messages: MailpitMessage[] }>("/api/v1/messages?limit=50");
    const match = messages.find((message) =>
      message.To.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
    );
    if (match) {
      const body = await json<{ HTML: string; Text: string }>(`/api/v1/message/${match.ID}`);
      return body.HTML || body.Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No email arrived for ${email} within ${timeoutMs}ms.`);
}

/**
 * Pulls the first confirmation/recovery link out of a message body.
 *
 * Supabase links point at its own `/auth/v1/verify` endpoint, which then
 * redirects to our callback — following it is what exercises the real
 * redirect chain rather than a hand-built URL.
 */
export function extractAuthLink(body: string): string {
  const match = body.match(/https?:\/\/[^"'\s<>]*\/auth\/v1\/verify[^"'\s<>]*/);
  if (!match) throw new Error("No Supabase auth link found in the email body.");
  return match[0].replaceAll("&amp;", "&");
}

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" }).catch(() => undefined);
}
