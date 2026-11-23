# SkyShop — React + Vite Frontend

The storefront is now integrated with the separate Express API in `../server`. It requests catalogue data from MongoDB through the API, supports registration/sign-in, stores authenticated carts in MongoDB, and submits orders to the order endpoint. Guest carts and the wishlist remain browser-local.

## Requirements

- Node.js (current LTS recommended)
- npm
- The SkyShop backend running at `http://localhost:5000`

## Run

1. In a terminal, configure and start the backend using the root `README.md`.
2. In a second terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Open the Vite URL, usually `http://localhost:5173`.

Optionally copy `.env.example` to `.env` and change `VITE_API_URL` if the backend API is hosted elsewhere. Restart Vite after modifying environment settings.

## Connected functionality

- Product list: `GET /api/products`
- Customer registration and login: `POST /api/auth/register`, `POST /api/auth/login`
- Session validation: `GET /api/auth/me`
- Signed-in cart: `GET/PUT /api/carts/me`, `PATCH /api/carts/me/items/:productId`
- Checkout/order creation: `POST /api/orders`
- Local product images resolve by filename against `src/images`.

The storefront falls back to bundled demo products if the API cannot be reached. A small status badge shows whether the backend catalogue is connected or the app is in demo mode. If MongoDB is connected but the `products` collection is empty, seed records from the backend instead of relying on the fallback.

No payment gateway is connected. The selected payment method is saved to the order, but actual payment processing is not performed. The wishlist and newsletter UI remain demo/local because the current database design has no corresponding collections.
