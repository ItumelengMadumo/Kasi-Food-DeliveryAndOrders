import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, Send } from 'lucide-react';
import {
  createWhatsAppSimSession,
  formatMenuForWhatsApp,
  processWhatsAppSimMessage,
  type WhatsAppMenuItem,
  type WhatsAppPaymentMethod,
  type WhatsAppSimSession,
} from '../domain/whatsappMenu';

interface WhatsAppMenuPreviewProps {
  vendorName: string;
  menuItems: WhatsAppMenuItem[];
  /** WhatsApp number this preview represents (purely cosmetic). */
  whatsappNumber?: string;
  /** Fired when the simulated checkout completes. */
  onSimulatedOrder?: (order: {
    orderId: string;
    customerName: string;
    paymentMethod: WhatsAppPaymentMethod;
    total: number;
  }) => void;
}

interface ChatBubble {
  id: string;
  side: 'in' | 'out';
  text: string;
}

/**
 * Interactive WhatsApp preview — vendors can type messages and walk through
 * the full ordering flow (menu → cart → name → payment → confirmation).
 *
 * State machine mirrors `infra/lambda/whatsappWebhook/index.js` via
 * `processWhatsAppSimMessage` in `frontend/src/domain/whatsappMenu.ts`.
 */
export function WhatsAppMenuPreview({
  vendorName,
  menuItems,
  whatsappNumber,
  onSimulatedOrder,
}: WhatsAppMenuPreviewProps) {
  const initialMenuMessage = useMemo(
    () => formatMenuForWhatsApp(vendorName, menuItems),
    [vendorName, menuItems]
  );

  const [session, setSession] = useState<WhatsAppSimSession>(() =>
    createWhatsAppSimSession(menuItems)
  );
  const [messages, setMessages] = useState<ChatBubble[]>(() => [
    { id: 'greet-out', side: 'out', text: 'Hi 👋' },
    { id: 'greet-in', side: 'in', text: initialMenuMessage },
  ]);
  const [input, setInput] = useState('');

  const availableCount = menuItems.filter((i) => i.available !== false).length;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // If the menu / vendor name changes, reset the chat so the preview reflects it.
  useEffect(() => {
    setSession(createWhatsAppSimSession(menuItems));
    setMessages([
      { id: `greet-out-${Date.now()}`, side: 'out', text: 'Hi 👋' },
      { id: `greet-in-${Date.now()}`, side: 'in', text: initialMenuMessage },
    ]);
    setInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMenuMessage]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const result = processWhatsAppSimMessage(
      session,
      vendorName || 'Your Shop',
      menuItems,
      trimmed
    );

    const stamp = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `out-${stamp}`, side: 'out', text: trimmed },
      { id: `in-${stamp}`, side: 'in', text: result.reply },
    ]);
    setSession(result.session);
    setInput('');

    if (result.orderConfirmed && onSimulatedOrder) {
      onSimulatedOrder({
        orderId: result.orderConfirmed.orderId,
        customerName: result.orderConfirmed.customerName,
        paymentMethod: result.orderConfirmed.paymentMethod,
        total: result.orderConfirmed.total,
      });
    }
  }

  function reset() {
    setSession(createWhatsAppSimSession(menuItems));
    setMessages([
      { id: `greet-out-${Date.now()}`, side: 'out', text: 'Hi 👋' },
      { id: `greet-in-${Date.now()}`, side: 'in', text: initialMenuMessage },
    ]);
    setInput('');
  }

  const quickReplies = buildQuickReplies(session);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <MessageCircle className="text-emerald-600 mt-0.5" size={18} />
        <div className="text-sm text-emerald-900 flex-1">
          <p className="font-semibold">Try the WhatsApp ordering flow</p>
          <p className="text-emerald-800/80">
            Type messages below to simulate exactly what your customers
            experience when they message
            {whatsappNumber ? (
              <> <span className="font-mono">{whatsappNumber}</span></>
            ) : (
              ' your WhatsApp number'
            )}
            . Reply with an item number, then <strong>C</strong> to confirm,
            your name, then a payment option.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold inline-flex items-center gap-1"
          aria-label="Reset conversation"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Phone-frame mock */}
      <div className="mx-auto max-w-sm bg-[#0b141a] rounded-3xl p-3 shadow-lg">
        {/* Header */}
        <div className="bg-[#202c33] text-white rounded-t-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-semibold">
            {vendorName.charAt(0).toUpperCase() || 'V'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm">{vendorName || 'Your Shop'}</p>
            <p className="text-xs text-emerald-200/70">
              {session.step === 'DONE' ? 'order confirmed' : 'online'}
            </p>
          </div>
        </div>

        {/* Chat scroll area */}
        <div
          ref={scrollRef}
          className="px-3 py-4 max-h-[420px] min-h-[280px] overflow-y-auto"
          style={{ backgroundColor: '#0b141a' }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex mb-2 ${m.side === 'out' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl px-3 py-2 max-w-[85%] text-sm shadow whitespace-pre-wrap leading-relaxed ${
                  m.side === 'out'
                    ? 'bg-[#005c4b] text-white rounded-tr-sm'
                    : 'bg-[#202c33] text-stone-100 rounded-tl-sm'
                }`}
              >
                {renderWhatsAppMarkdown(m.text)}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="bg-[#202c33] rounded-b-2xl px-2 py-2">
          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 px-1">
              {quickReplies.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => send(q.value)}
                  className="text-xs bg-[#2a3942] hover:bg-[#374955] text-stone-100 px-2.5 py-1 rounded-full"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={inputPlaceholder(session)}
              className="flex-1 bg-[#2a3942] text-stone-100 placeholder:text-stone-400 text-sm rounded-full px-4 py-2 outline-none border-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center text-white"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-stone-500 text-center">
        {availableCount} item{availableCount === 1 ? '' : 's'} visible to customers
        {menuItems.length - availableCount > 0
          ? ` · ${menuItems.length - availableCount} hidden`
          : ''}
        {' · '}
        <span className="font-mono">{stepLabel(session.step)}</span>
      </p>
    </div>
  );
}

function inputPlaceholder(session: WhatsAppSimSession): string {
  switch (session.step) {
    case 'SELECTING_ITEMS':
      return 'Item number (e.g. 1 or 1 x2), C to confirm';
    case 'CONFIRM_ORDER':
      return 'Type your full name';
    case 'PAYMENT':
      return 'Reply 1, 2 or 3';
    case 'DONE':
      return 'Reply 0 to start a new order';
    default:
      return 'Type a message';
  }
}

function buildQuickReplies(
  session: WhatsAppSimSession
): { label: string; value: string }[] {
  switch (session.step) {
    case 'SELECTING_ITEMS': {
      const replies: { label: string; value: string }[] = [];
      const max = Math.min(session.menuContext.length, 4);
      for (let i = 1; i <= max; i++) replies.push({ label: `${i}`, value: `${i}` });
      if (session.cart.length > 0) {
        replies.push({ label: 'Confirm (C)', value: 'C' });
        replies.push({ label: 'Remove last (R)', value: 'R' });
      }
      return replies;
    }
    case 'PAYMENT':
      return [
        { label: '1 · Cash pickup', value: '1' },
        { label: '2 · EFT', value: '2' },
        { label: '3 · Cash delivery', value: '3' },
      ];
    case 'DONE':
      return [{ label: '0 · New order', value: '0' }];
    default:
      return [];
  }
}

function stepLabel(step: WhatsAppSimSession['step']): string {
  switch (step) {
    case 'START':
      return 'idle';
    case 'SELECTING_ITEMS':
      return 'selecting items';
    case 'CONFIRM_ORDER':
      return 'awaiting name';
    case 'PAYMENT':
      return 'awaiting payment';
    case 'DONE':
      return 'order confirmed';
  }
}

/**
 * Lightweight WhatsApp markdown renderer:
 *   *bold*  → <strong>
 *   _italic_ → <em>
 */
function renderWhatsAppMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return tokens.map((token, idx) => {
    if (/^\*[^*\n]+\*$/.test(token)) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(1, -1)}
        </strong>
      );
    }
    if (/^_[^_\n]+_$/.test(token)) {
      return (
        <em key={idx} className="italic text-stone-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}
