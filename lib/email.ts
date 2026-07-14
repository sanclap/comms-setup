const ZEPTO_SINGLE_URL = "https://api.zeptomail.in/v1.1/email";

export interface Attachment {
  name: string;       // filename shown to recipient
  content: string;    // base64 encoded content
  mime_type: string;  // e.g. "application/pdf"
}

export interface EmailPayload {
  to: { email: string; name: string };
  subject: string;
  htmlBody: string;
  attachments?: Attachment[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const body: Record<string, unknown> = {
    from: {
      address: process.env.ZEPTO_FROM_EMAIL || "noreply@edxso.com",
      name: process.env.ZEPTO_FROM_NAME || "Team EDXSO",
    },
    to: [{ email_address: { address: payload.to.email, name: payload.to.name } }],
    subject: payload.subject,
    htmlbody: payload.htmlBody,
  };

  if (payload.attachments && payload.attachments.length > 0) {
    body.attachments = payload.attachments.map((a) => ({
      name: a.name,
      content: a.content,
      mime_type: a.mime_type,
    }));
  }

  try {
    const response = await fetch(ZEPTO_SINGLE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${process.env.ZEPTO_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok && (data.message === "OK" || data.message === "ok")) {
      return {
        success: true,
        messageId: data.request_id || undefined,
        raw: data,
      };
    }

    return {
      success: false,
      error: data?.message || data?.error?.message || `HTTP ${response.status}`,
      raw: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function renderTemplate(
  templateBody: string,
  vars: Record<string, string>
): string {
  let rendered = templateBody;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return rendered;
}
