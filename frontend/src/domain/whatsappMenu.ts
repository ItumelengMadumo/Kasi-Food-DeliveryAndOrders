/**
 * WhatsApp menu/cart formatters — frontend mirror.
 *
 * IMPORTANT: This file MUST stay in sync with
 *   infra/lambda/_shared/whatsappMenu.js
 *
 * The Lambda module is the source of truth for what customers see on
 * WhatsApp. This TS copy exists so the vendor dashboard can render an
 * accurate in-app preview without an extra round-trip to AWS.
 *
 * If you change the format here, change it there too. There is a
 * snapshot test in `frontend/src/test/whatsappMenu.test.ts` to keep us
 * honest.
 */

export interface WhatsAppMenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  available?: boolean;
  description?: string;
}

export interface WhatsAppCartLine {
  name: string;
  price: number;
  quantity: number;
}

export function formatMenuForWhatsApp(
  vendorName: string,
  menuItems: WhatsAppMenuItem[]
): string {
  const available = (menuItems || []).filter((i) => i && i.available !== false);

  if (available.length === 0) {
    return (
      `Welcome to *${vendorName}* 🍔\n\n` +
      `Sorry, no items are available right now. Please try again later.`
    );
  }

  let msg = `Welcome to *${vendorName}* 🍔\n\nHere's our menu:\n\n`;

  const grouped = new Map<string, WhatsAppMenuItem[]>();
  for (const item of available) {
    const category = item.category || 'Menu';
    const list = grouped.get(category) || [];
    list.push(item);
    grouped.set(category, list);
  }

  let index = 1;
  for (const [category, items] of grouped.entries()) {
    msg += `*${category}:*\n`;
    for (const item of items) {
      msg += `${index}. *${item.name}* — R${Number(item.price).toFixed(2)}\n`;
      index += 1;
    }
    msg += '\n';
  }

  msg +=
    '\nReply with the item *number* and quantity:\n' +
    '• *1* for one\n' +
    '• *1 x2* for two\n\n' +
    '_Reply *0* at any time to restart_';

  return msg;
}

export function formatCartForWhatsApp(cart: WhatsAppCartLine[]): string {
  if (!cart || cart.length === 0) return 'Your cart is empty.';

  let msg = '🛒 *Your cart:*\n';
  let total = 0;
  for (const item of cart) {
    const lineTotal = Number(item.price) * Number(item.quantity);
    total += lineTotal;
    msg += `• ${item.name} x${item.quantity} = R${lineTotal.toFixed(2)}\n`;
  }
  msg += `\n*Total: R${total.toFixed(2)}*`;
  return msg;
}

// ─── Interactive simulator (mirrors infra/lambda/whatsappWebhook) ──────────

export type WhatsAppSimStep =
  | 'START'
  | 'SELECTING_ITEMS'
  | 'CONFIRM_ORDER'
  | 'PAYMENT'
  | 'DONE';

export type WhatsAppPaymentMethod =
  | 'CASH_ON_PICKUP'
  | 'EFT'
  | 'CASH_ON_DELIVERY';

export interface WhatsAppSimSession {
  step: WhatsAppSimStep;
  cart: WhatsAppCartLine[];
  /** Ordered list of available items (drives global numbering). */
  menuContext: WhatsAppMenuItem[];
  customerName?: string;
  paymentMethod?: WhatsAppPaymentMethod;
  /** Generated when an order is confirmed. */
  orderId?: string;
}

export interface WhatsAppSimReply {
  session: WhatsAppSimSession;
  /** Bot reply text (WhatsApp markdown). */
  reply: string;
  /** Set on the message that finalises an order. */
  orderConfirmed?: {
    orderId: string;
    customerName: string;
    paymentMethod: WhatsAppPaymentMethod;
    cart: WhatsAppCartLine[];
    total: number;
  };
}

export function createWhatsAppSimSession(
  menuItems: WhatsAppMenuItem[]
): WhatsAppSimSession {
  return {
    step: 'START',
    cart: [],
    menuContext: (menuItems || []).filter((i) => i && i.available !== false),
  };
}

function shortOrderId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Process a single inbound customer message and return the next session +
 * bot reply. Pure function — safe to call from React state.
 *
 * Mirrors the state machine in `infra/lambda/whatsappWebhook/index.js`.
 */
export function processWhatsAppSimMessage(
  session: WhatsAppSimSession,
  vendorName: string,
  menuItems: WhatsAppMenuItem[],
  rawMessage: string
): WhatsAppSimReply {
  const messageText = (rawMessage || '').trim();
  const upperMsg = messageText.toUpperCase();

  // Global restart
  if (upperMsg === '0' || session.step === 'START' || session.step === 'DONE') {
    const fresh = createWhatsAppSimSession(menuItems);
    if (fresh.menuContext.length === 0) {
      return {
        session: { ...fresh, step: 'START' },
        reply:
          `Welcome to *${vendorName}*! 👋\n` +
          `We don't have any menu items available right now. Please try again later.`,
      };
    }
    return {
      session: { ...fresh, step: 'SELECTING_ITEMS' },
      reply: formatMenuForWhatsApp(vendorName, fresh.menuContext),
    };
  }

  if (session.step === 'SELECTING_ITEMS') {
    const cart = session.cart;
    const menuContext = session.menuContext;

    if (upperMsg === 'C' || upperMsg === 'CONFIRM') {
      if (cart.length === 0) {
        return {
          session,
          reply: 'Your cart is empty. Please add some items first.',
        };
      }
      return {
        session: { ...session, step: 'CONFIRM_ORDER' },
        reply:
          `${formatCartForWhatsApp(cart)}\n\n` +
          'Please reply with your *full name* to confirm your order.\n' +
          '_(e.g. "Sipho Mokoena")_',
      };
    }

    if (upperMsg === 'R' || upperMsg === 'REMOVE') {
      if (cart.length === 0) {
        return { session, reply: 'Your cart is already empty.' };
      }
      const newCart = cart.slice(0, -1);
      const next = { ...session, cart: newCart };
      if (newCart.length === 0) {
        return {
          session: next,
          reply:
            '✅ Removed. Cart is now empty.\nReply with an item number to add items.',
        };
      }
      return {
        session: next,
        reply:
          `✅ Last item removed.\n\n${formatCartForWhatsApp(newCart)}\n\n` +
          'Reply with item *number* to add more\n*C* to confirm • *R* to remove last item',
      };
    }

    const match = messageText.match(/^(\d+)\s*(?:x\s*)?(\d+)?$/i);
    if (!match) {
      return {
        session,
        reply:
          "❌ I didn't understand that.\n\n" +
          'Reply with item *number* (e.g. *1* or *1 x2*)\n' +
          '*C* to confirm • *R* to remove last item • *0* to restart',
      };
    }

    const itemIndex = parseInt(match[1], 10) - 1;
    const quantity = parseInt(match[2] || '1', 10);

    if (itemIndex < 0 || itemIndex >= menuContext.length) {
      return {
        session,
        reply: `❌ Invalid item number. Please choose 1–${menuContext.length}.`,
      };
    }
    if (quantity < 1 || quantity > 20) {
      return { session, reply: '❌ Quantity must be between 1 and 20.' };
    }

    const selected = menuContext[itemIndex];
    const existingIdx = cart.findIndex((c) => c.name === selected.name);
    const newCart =
      existingIdx >= 0
        ? cart.map((c, i) =>
            i === existingIdx ? { ...c, quantity: c.quantity + quantity } : c
          )
        : [
            ...cart,
            { name: selected.name, price: selected.price, quantity },
          ];

    return {
      session: { ...session, cart: newCart },
      reply:
        `✅ Added *${selected.name}* x${quantity}\n\n` +
        `${formatCartForWhatsApp(newCart)}\n\n` +
        'Reply with item *number* to add more\n*C* to confirm • *R* to remove last item • *0* to restart',
    };
  }

  if (session.step === 'CONFIRM_ORDER') {
    const customerName = messageText;
    if (!customerName || customerName.length < 2) {
      return {
        session,
        reply: 'Please reply with your *full name* to confirm the order.',
      };
    }
    return {
      session: { ...session, step: 'PAYMENT', customerName },
      reply:
        `Thanks, *${customerName}*! 👋\n\n` +
        'How would you like to pay?\n\n' +
        '1. 💵 Cash on pickup\n' +
        '2. 🏦 EFT (Bank transfer)\n' +
        '3. 🚚 Cash on delivery\n\n' +
        'Reply with *1*, *2*, or *3*',
    };
  }

  if (session.step === 'PAYMENT') {
    let paymentMethod: WhatsAppPaymentMethod | undefined;
    if (upperMsg === '1') paymentMethod = 'CASH_ON_PICKUP';
    else if (upperMsg === '2') paymentMethod = 'EFT';
    else if (upperMsg === '3') paymentMethod = 'CASH_ON_DELIVERY';
    else {
      return {
        session,
        reply:
          'Please reply with *1* (Cash on pickup), *2* (EFT), or *3* (Cash on delivery).',
      };
    }

    const cart = session.cart;
    const customerName = session.customerName || 'Guest';
    const orderId = shortOrderId();
    const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

    const confirmMsg =
      `✅ *Order Confirmed!*\n\n` +
      `Order #${orderId}\n\n` +
      `${formatCartForWhatsApp(cart)}\n\n` +
      `Payment: *${paymentMethod.replace(/_/g, ' ')}*\n\n` +
      `We'll notify you when it's ready! 🙌\n\n` +
      `_Reply *0* to place a new order_`;

    return {
      session: {
        ...session,
        step: 'DONE',
        paymentMethod,
        orderId,
      },
      reply: confirmMsg,
      orderConfirmed: {
        orderId,
        customerName,
        paymentMethod,
        cart,
        total,
      },
    };
  }

  return { session, reply: 'Reply *0* to start a new order. 😊' };
}
