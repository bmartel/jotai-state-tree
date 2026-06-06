import { types, Instance } from 'jotai-state-tree';

export const Product = types.model('Product', {
  id: types.identifier,
  name: types.string,
  price: types.number,
  description: types.string,
});

export const CartItem = types
  .model('CartItem', {
    product: types.reference(Product),
    quantity: types.optional(types.integer, 1),
  })
  .views((self) => ({
    get total() {
      return self.product.price * self.quantity;
    },
  }))
  .actions((self) => ({
    setQuantity(qty: number) {
      if (qty > 0) {
        self.quantity = qty;
      }
    },
    increment() {
      self.quantity += 1;
    },
    decrement() {
      if (self.quantity > 1) {
        self.quantity -= 1;
      }
    },
  }));

export const ShopStore = types
  .model('ShopStore', {
    catalog: types.optional(types.map(Product), {}),
    cart: types.optional(types.array(CartItem), []),
    couponCode: types.optional(types.string, ''),
    checkoutStatus: types.optional(types.string, 'idle'), // 'idle' | 'processing' | 'success' | 'failed'
  })
  // Views Chain Part 1: Independent views
  .views((self) => ({
    get cartSubtotal() {
      return self.cart.reduce((sum, item) => sum + item.total, 0);
    },
    get discountPercent() {
      const code = self.couponCode.toUpperCase().trim();
      if (code === 'SAVE10') return 10;
      if (code === 'SAVE20') return 20;
      return 0;
    },
    get cartItemCount() {
      return self.cart.reduce((sum, item) => sum + item.quantity, 0);
    },
  }))
  // Views Chain Part 2: Depends on Part 1 views
  .views((self) => ({
    get discountAmount() {
      return (self.cartSubtotal * self.discountPercent) / 100;
    },
  }))
  // Views Chain Part 3: Depends on Part 2 views
  .views((self) => ({
    get taxAmount() {
      return (self.cartSubtotal - self.discountAmount) * 0.08;
    },
  }))
  // Views Chain Part 4: Depends on Part 3 views
  .views((self) => ({
    get cartTotal() {
      return self.cartSubtotal - self.discountAmount + self.taxAmount;
    },
  }))
  .actions((self) => ({
    addToCart(productId: string) {
      const product = self.catalog.get(productId);
      if (!product) return;

      const existing = self.cart.find((item) => item.product.id === productId);
      if (existing) {
        existing.increment();
      } else {
        self.cart.push({
          product: product.id, // Reference values must be assigned by their identifier
          quantity: 1,
        });
      }
    },
    removeFromCart(productId: string) {
      const existing = self.cart.find((item) => item.product.id === productId);
      if (existing) {
        self.cart.remove(existing);
      }
    },
    applyCoupon(code: string) {
      self.couponCode = code;
    },
    setCheckoutStatus(status: string) {
      self.checkoutStatus = status;
    },
    clearCart() {
      self.cart.clear();
      self.couponCode = '';
    },
  }))
  .actions((self) => ({
    async checkout() {
      if (self.cart.length === 0) return;
      
      self.setCheckoutStatus('processing');
      
      try {
        // Simulate API network request
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Randomly succeed or fail
        if (Math.random() > 0.15) {
          self.clearCart();
          self.setCheckoutStatus('success');
        } else {
          self.setCheckoutStatus('failed');
        }
      } catch (err) {
        self.setCheckoutStatus('failed');
      }
      
      // Auto-reset state back to idle
      setTimeout(() => {
        self.setCheckoutStatus('idle');
      }, 4000);
    },
  }));

export type IShopStore = Instance<typeof ShopStore>;
export type ICartItem = Instance<typeof CartItem>;
export type IProduct = Instance<typeof Product>;
