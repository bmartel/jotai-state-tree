/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/shopping-cart-views/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
  vi.restoreAllMocks();
});

describe('Shopping Cart with Views Example App', () => {
  it('should support catalog browsing, cart operations, computed reactive views, discount coupon codes, and checkout flow', async () => {
    console.log('--- START TEST 1 ---');
    const user = userEvent.setup();

    console.log('Rendering App...');
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('App rendered.');

    // 1. Verify Catalog Items & Empty Cart State
    expect(screen.getByText('Mechanical Keyboard')).toBeDefined();
    expect(screen.getByText('Ergonomic Mouse')).toBeDefined();
    expect(screen.getByText('4K UltraWide Monitor')).toBeDefined();
    expect(screen.getByText('Noise-Cancelling Headphones')).toBeDefined();
    expect(screen.getByText('Your cart is empty. Add products to get started.')).toBeDefined();
    console.log('Initial state verified.');

    // 2. Add Item to Cart
    const addButtons = screen.getAllByRole('button', { name: 'Add to Cart' });
    console.log('Found add buttons, count:', addButtons.length);
    
    // Add Keyboard (1st item, index 0)
    console.log('Clicking add keyboard button...');
    await user.click(addButtons[0]);
    console.log('Clicked add keyboard button.');

    // Cart should no longer be empty
    const cartPanel = screen.getByText(/Your Cart \(/).closest('.cart-panel')!;
    console.log('Found cart panel.');

    console.log('Waiting for Keyboard to appear in cart...');
    await waitFor(() => {
      expect(within(cartPanel).getByText('Mechanical Keyboard')).toBeDefined();
    });
    console.log('Keyboard appears in cart.');

    // Subtotal should be $129.99
    expect(within(cartPanel).getByText('$129.99')).toBeDefined(); // Subtotal
    expect(within(cartPanel).getByText('$10.40')).toBeDefined();  // Tax (8% of $129.99 = 10.3992 -> 10.40)
    expect(within(cartPanel).getByText('$140.39')).toBeDefined(); // Total (129.99 + 10.40 = 140.39)
    console.log('Pricing verified for 1 Keyboard.');

    // 3. Increment Quantity
    const plusBtn = within(cartPanel).getByRole('button', { name: '+' });
    console.log('Clicking plus button...');
    await user.click(plusBtn);
    console.log('Clicked plus button.');

    await waitFor(() => {
      expect(within(cartPanel).getByText('2')).toBeDefined();
    });
    console.log('Quantity updated to 2.');

    // Subtotal should now be $259.98
    expect(within(cartPanel).getByText('$259.98')).toBeDefined(); // Subtotal
    expect(within(cartPanel).getByText('$20.80')).toBeDefined();  // Tax (20.7984 -> 20.80)
    expect(within(cartPanel).getByText('$280.78')).toBeDefined(); // Total
    console.log('Pricing verified for 2 Keyboards.');

    // Add Ergonomic Mouse (2nd item, index 1)
    console.log('Clicking add mouse button...');
    await user.click(addButtons[1]);
    console.log('Clicked add mouse button.');
    await waitFor(() => {
      expect(within(cartPanel).getByText('Ergonomic Mouse')).toBeDefined();
    });
    console.log('Mouse appears in cart.');

    // Subtotal should be 259.98 + 79.99 = $339.97
    expect(within(cartPanel).getByText('$339.97')).toBeDefined(); // Subtotal
    console.log('Pricing verified for 2 Keyboards + 1 Mouse.');

    // 4. Apply Coupon (10% Discount)
    const couponInput = within(cartPanel).getByPlaceholderText('Discount Code (SAVE10, SAVE20)');
    const applyBtn = within(cartPanel).getByRole('button', { name: 'Apply' });

    console.log('Typing coupon...');
    await user.type(couponInput, 'SAVE10');
    console.log('Clicking apply coupon button...');
    await user.click(applyBtn);
    console.log('Clicked apply coupon button.');

    await waitFor(() => {
      expect(within(cartPanel).getByText('Discount (10%)')).toBeDefined();
      expect(within(cartPanel).getByText('-$34.00')).toBeDefined();
      expect(within(cartPanel).getByText('$24.48')).toBeDefined();
      expect(within(cartPanel).getByText('$330.45')).toBeDefined();
    });
    console.log('Coupon pricing verified.');

    // 5. Test Asynchronous Checkout Success Flow
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Force success (> 0.15)

    const placeOrderBtn = within(cartPanel).getByRole('button', { name: 'Place Order' });
    console.log('Clicking Place Order button...');
    await user.click(placeOrderBtn);
    console.log('Clicked Place Order button.');

    // Should show spinner / processing text
    expect(within(cartPanel).getByText('Processing Order...')).toBeDefined();

    console.log('Waiting for checkout to complete (using real timers)...');
    // We wait for checkout status to change to success (which takes 2000ms)
    await waitFor(() => {
      expect(within(cartPanel).getByText(/Order placed successfully/)).toBeDefined();
      expect(within(cartPanel).getByText('Your cart is empty. Add products to get started.')).toBeDefined();
    }, { timeout: 4000 });
    console.log('Success toast verified.');

    // Wait for the toast to auto-clear (takes 4000ms in code, but we can just end the test here or wait)
    console.log('Waiting for toast to clear...');
    await waitFor(() => {
      expect(within(cartPanel).queryByText(/Order placed successfully/)).toBeNull();
    }, { timeout: 6000 });
    console.log('Toast cleared verified.');
    console.log('--- END TEST 1 ---');
  }, 12000); // 12 seconds timeout for this test

  it('should handle payment/checkout failure scenarios correctly', async () => {
    console.log('--- START TEST 2 ---');
    const user = userEvent.setup();

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // Add Keyboard
    const addButtons = screen.getAllByRole('button', { name: 'Add to Cart' });
    await user.click(addButtons[0]);

    const cartPanel = screen.getByText(/Your Cart \(/).closest('.cart-panel')!;

    await waitFor(() => {
      expect(within(cartPanel).getByText('Mechanical Keyboard')).toBeDefined();
    });

    // Force failure (< 0.15)
    vi.spyOn(Math, 'random').mockReturnValue(0.05);

    const placeOrderBtn = within(cartPanel).getByRole('button', { name: 'Place Order' });
    await user.click(placeOrderBtn);

    expect(within(cartPanel).getByText('Processing Order...')).toBeDefined();

    // Wait for checkout status to change to failed
    await waitFor(() => {
      expect(within(cartPanel).getByText(/Payment failed/)).toBeDefined();
      expect(within(cartPanel).getByText('Mechanical Keyboard')).toBeDefined();
    }, { timeout: 4000 });

    console.log('--- END TEST 2 ---');
  }, 8000); // 8 seconds timeout for this test
});
