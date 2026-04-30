'use strict';

/**
 * Shared WhatsApp menu/cart formatters.
 *
 * IMPORTANT: This file must stay in sync with
 *   frontend/src/domain/whatsappMenu.ts
 * The frontend uses the TS mirror to render an in-app preview of what
 * customers see on WhatsApp. Both implementations are intentionally
 * minimal so they are easy to keep identical.
 */

/**
 * Format the vendor menu for WhatsApp display.
 *
 * @param {string} vendorName
 * @param {Array<{id:string, name:string, price:number, category?:string, available?:boolean, description?:string}>} menuItems
 *   Items are expected pre-filtered to available ones, but this function
 *   defensively filters again so callers can pass raw lists.
 * @returns {string} ready-to-send WhatsApp message body
 */
function formatMenuForWhatsApp(vendorName, menuItems) {
  const available = (menuItems || []).filter((i) => i && i.available !== false);

  if (available.length === 0) {
    return (
      `Welcome to *${vendorName}* 🍔\n\n` +
      `Sorry, no items are available right now. Please try again later.`
    );
  }

  let msg = `Welcome to *${vendorName}* 🍔\n\nHere's our menu:\n\n`;

  // Group by category, preserving first-seen order
  const grouped = new Map();
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

/**
 * Format a WhatsApp cart summary line list with running total.
 *
 * @param {Array<{name:string, price:number, quantity:number}>} cart
 * @returns {string}
 */
function formatCartForWhatsApp(cart) {
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

module.exports = {
  formatMenuForWhatsApp,
  formatCartForWhatsApp,
};
