import { describe, it, expect } from 'vitest';
import {
  formatMenuForWhatsApp,
  formatCartForWhatsApp,
  type WhatsAppMenuItem,
} from '../domain/whatsappMenu';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lambdaShared = require('../../../infra/lambda/_shared/whatsappMenu.js');

const sampleMenu: WhatsAppMenuItem[] = [
  { id: '1', name: 'Pap & Wors', price: 45, category: 'Meals', available: true },
  { id: '2', name: 'Chicken Feet', price: 30, category: 'Meals', available: true },
  { id: '3', name: 'Russian & Chips', price: 50, category: 'Meals', available: true },
  { id: '4', name: 'Coke 500ml', price: 18, category: 'Drinks', available: true },
  { id: '5', name: 'Hidden Item', price: 99, category: 'Meals', available: false },
];

describe('formatMenuForWhatsApp', () => {
  it('renders the same string in TS and JS shared module', () => {
    const ts = formatMenuForWhatsApp('Mama Joy Kitchen', sampleMenu);
    const js = lambdaShared.formatMenuForWhatsApp('Mama Joy Kitchen', sampleMenu);
    expect(ts).toBe(js);
  });

  it('numbers items globally across categories and skips unavailable items', () => {
    const out = formatMenuForWhatsApp('Mama Joy', sampleMenu);
    expect(out).toContain('*Mama Joy*');
    expect(out).toContain('1. *Pap & Wors* — R45.00');
    expect(out).toContain('4. *Coke 500ml* — R18.00');
    expect(out).not.toContain('Hidden Item');
  });

  it('handles empty/all-unavailable menu gracefully', () => {
    const out = formatMenuForWhatsApp('Quiet Shop', []);
    expect(out).toContain('Sorry, no items are available right now');
  });

  it('defaults missing category to "Menu"', () => {
    const out = formatMenuForWhatsApp('Vendor', [
      { id: '1', name: 'Item', price: 10, available: true },
    ]);
    expect(out).toContain('*Menu:*');
  });
});

describe('formatCartForWhatsApp', () => {
  it('matches the JS shared module output', () => {
    const cart = [
      { name: 'Pap & Wors', price: 45, quantity: 2 },
      { name: 'Coke 500ml', price: 18, quantity: 1 },
    ];
    const ts = formatCartForWhatsApp(cart);
    const js = lambdaShared.formatCartForWhatsApp(cart);
    expect(ts).toBe(js);
    expect(ts).toContain('Total: R108.00');
  });

  it('returns empty-cart message for empty input', () => {
    expect(formatCartForWhatsApp([])).toBe('Your cart is empty.');
  });
});
