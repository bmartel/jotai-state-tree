import React, { useState } from 'react';
import { createStoreContext } from 'jotai-state-tree/react';
import { ShopStore, IShopStore } from './store';

const { Provider, useStore, useStoreSnapshot } = createStoreContext<IShopStore>();

const CATALOG_ITEMS = [
  { id: 'p1', name: 'Mechanical Keyboard', price: 129.99, description: 'Tactile switches, RGB backlight, anodized aluminum frame.' },
  { id: 'p2', name: 'Ergonomic Mouse', price: 79.99, description: 'Wireless, high-precision sensor, ergonomic thumb rest.' },
  { id: 'p3', name: '4K UltraWide Monitor', price: 449.99, description: '34-inch curved display, 144Hz refresh rate, HDR support.' },
  { id: 'p4', name: 'Noise-Cancelling Headphones', price: 299.99, description: 'Active noise cancellation, 30-hour battery life, spatial audio.' },
];

function AppContent() {
  const store = useStore();
  useStoreSnapshot();
  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    store.applyCoupon(couponInput);
  };

  const isCheckingOut = store.checkoutStatus === 'processing';

  return (
    <div className="container-cart">
      <header>
        <h1>Electronic Shop</h1>
        <p className="subtitle">Reactive derived views and asynchronous flow workflows</p>
      </header>

      <div className="shop-layout">
        {/* Product Catalog */}
        <div>
          <h2 className="section-title">Products</h2>
          <div className="products-grid">
            {CATALOG_ITEMS.map((item) => (
              <div key={item.id} className="product-card">
                <div>
                  <h3 className="product-title">{item.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-gray-500)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {item.description}
                  </p>
                </div>
                <div className="flex-between">
                  <span className="product-price">${item.price.toFixed(2)}</span>
                  <button
                    className="primary"
                    onClick={() => store.addToCart(item.id)}
                    disabled={isCheckingOut}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shopping Cart Summary */}
        <div className="cart-panel">
          <h2 className="section-title">Your Cart ({store.cartItemCount})</h2>

          {store.cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', fontSize: '13px', margin: '40px 0' }}>
              Your cart is empty. Add products to get started.
            </div>
          ) : (
            <>
              <div className="cart-items-list">
                {store.cart.map((item) => (
                  <div key={item.product.id} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.product.name}</span>
                      <span className="cart-item-price">${item.product.price.toFixed(2)} each</span>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => item.decrement()}
                        disabled={isCheckingOut || item.quantity <= 1}
                      >
                        -
                      </button>
                      <span className="quantity-display">{item.quantity}</span>
                      <button
                        onClick={() => item.increment()}
                        disabled={isCheckingOut}
                      >
                        +
                      </button>
                      <button
                        className="icon-btn"
                        style={{ marginLeft: '6px' }}
                        onClick={() => store.removeFromCart(item.product.id)}
                        disabled={isCheckingOut}
                        title="Remove item"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Code Section */}
              <form onSubmit={handleApplyCoupon} className="coupon-section">
                <input
                  type="text"
                  placeholder="Discount Code (SAVE10, SAVE20)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  disabled={isCheckingOut}
                />
                <button type="submit" disabled={isCheckingOut}>Apply</button>
              </form>

              {/* Pricing breakdown */}
              <div className="pricing-breakdown">
                <div className="pricing-line">
                  <span>Subtotal</span>
                  <span>${store.cartSubtotal.toFixed(2)}</span>
                </div>
                {store.discountAmount > 0 && (
                  <div className="pricing-line">
                    <span>Discount ({store.discountPercent}%)</span>
                    <span className="discount-tag">-${store.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pricing-line">
                  <span>Sales Tax (8%)</span>
                  <span>${store.taxAmount.toFixed(2)}</span>
                </div>
                <div className="pricing-line total">
                  <span>Estimated Total</span>
                  <span>${store.cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                className="primary"
                style={{ width: '100%', padding: '10px' }}
                onClick={() => store.checkout()}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? (
                  <>
                    <span className="spinner"></span>
                    Processing Order...
                  </>
                ) : (
                  'Place Order'
                )}
              </button>
            </>
          )}

          {/* Checkout Notification Toasts */}
          {store.checkoutStatus === 'success' && (
            <div className="toast" style={{ background: '#10b981' }}>
              <span>🎉 Order placed successfully! Thank you for your purchase.</span>
            </div>
          )}
          {store.checkoutStatus === 'failed' && (
            <div className="toast" style={{ background: '#ef4444' }}>
              <span>⚠️ Payment failed. Please check your card details and try again.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Provider createStore={() => {
      const catalogData: Record<string, any> = {};
      CATALOG_ITEMS.forEach(item => {
        catalogData[item.id] = item;
      });
      return ShopStore.create({
        catalog: catalogData,
        cart: []
      });
    }}>
      <AppContent />
    </Provider>
  );
}
