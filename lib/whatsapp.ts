// NexG Platforms WhatsApp API (replaces BagaChat)
const NEXG_API_URL = "https://automate.nexgplatforms.com/api/v1/wa/multi-send";

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

export interface WhatsAppRecipient {
  phone: string;
  /**
   * The dynamic value substituted into the approved WhatsApp template
   * (e.g. the recipient's name for a "Hi {{1}}, ..." template).
   * This is NOT arbitrary free text — NexG sends pre-approved template
   * messages, so the actual wording lives in the WhatsApp Business
   * template identified by templateId + messageId, not here.
   */
  message: string;
}

interface NexgMsgDetail {
  messageType: "template";
  contactnumber: string;
  messageid: string;
  buttonValues: string;
  dynamicUrl: string;
  message: string;
}

/**
 * Formats a raw phone number into the digits-only, country-code-prefixed
 * format NexG expects (e.g. "919876543210" — no "+", no spaces).
 */
export function formatPhone(raw: string): string | null {
  let phone = raw.toString().replace(/\D/g, "");
  if (phone.startsWith("0")) phone = phone.substring(1);
  if (!phone.startsWith("91")) phone = "91" + phone;
  if (phone.length !== 12) return null; // "91" + 10 digit mobile number
  return phone;
}

/**
 * Sends one WhatsApp template message to many recipients in a single
 * NexG multi-send API call. This is the efficient path — prefer this
 * over looping sendWhatsApp() for bulk sends.
 */
export async function sendWhatsAppBatch(
  recipients: WhatsAppRecipient[],
  opts?: { templateId?: string; messageId?: string; fromNumber?: string }
): Promise<Array<WhatsAppResult & { phone: string }>> {
  const templateId = opts?.templateId || process.env.NEXG_TEMPLATE_ID;
  const messageId = opts?.messageId || process.env.NEXG_MESSAGE_ID;
  const fromNumber = opts?.fromNumber || process.env.NEXG_FROM_NUMBER;
  const apiKey = process.env.NEXG_API_KEY;

  if (!templateId || !messageId || !fromNumber || !apiKey) {
    return recipients.map((r) => ({
      phone: r.phone,
      success: false,
      error: "Missing NexG config (NEXG_TEMPLATE_ID / NEXG_MESSAGE_ID / NEXG_FROM_NUMBER / NEXG_API_KEY)",
    }));
  }

  const results: Array<WhatsAppResult & { phone: string }> = [];
  const valid: { recipient: WhatsAppRecipient; formatted: string }[] = [];

  for (const r of recipients) {
    const formatted = formatPhone(r.phone);
    if (!formatted) {
      results.push({ phone: r.phone, success: false, error: "INVALID_NUMBER" });
      continue;
    }
    valid.push({ recipient: r, formatted });
  }

  if (valid.length === 0) return results;

  const msgDetails: NexgMsgDetail[] = valid.map(({ recipient, formatted }) => ({
    messageType: "template",
    contactnumber: formatted,
    messageid: messageId,
    buttonValues: "",
    dynamicUrl: "",
    message: recipient.message,
  }));

  const payload = {
    serviceType: "transactional",
    templateid: templateId,
    fromNumber,
    msgDetails,
  };

  try {
    const response = await fetch(NEXG_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // NexG didn't return JSON — keep raw text
    }

    const success = response.ok;
    const errorMsg =
      !success && parsed && typeof parsed === "object" && "message" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).message)
        : !success
          ? text || `HTTP ${response.status}`
          : undefined;

    for (const { recipient } of valid) {
      results.push({ phone: recipient.phone, success, error: errorMsg, raw: parsed });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    for (const { recipient } of valid) {
      results.push({ phone: recipient.phone, success: false, error });
    }
  }

  return results;
}

/**
 * Backward-compatible single-recipient wrapper — sends a "batch" of one.
 * Existing call sites (send-whatsapp route, webhook) keep working unchanged.
 */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<WhatsAppResult> {
  const [result] = await sendWhatsAppBatch([{ phone, message }]);
  const { phone: _phone, ...rest } = result;
  return rest;
}
