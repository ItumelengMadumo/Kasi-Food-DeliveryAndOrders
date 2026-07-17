// ─────────────────────────────────────────────────
// Tap-to-call / tap-to-WhatsApp link builders. These hand off to the
// customer's own phone dialer / WhatsApp app using the vendor's stored
// number — no backend, no Twilio involved.
// ─────────────────────────────────────────────────

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

/** wa.me requires digits only (no +, spaces, or dashes) with country code. */
export function whatsappHref(phone: string, message?: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digitsOnly}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
