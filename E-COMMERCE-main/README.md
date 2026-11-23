# CTINASSL_Activity

## SkyShop E-Commerce System

SkyShop is a MERN-based online store for browsing and purchasing everyday products. It includes a customer storefront and a role-protected admin dashboard for managing the catalog, orders, coupons, and users.

## Members

- Alde, Jarod Kyle
- San Diego, Renz Danniell

## Main Features

### Customer storefront

- Browse products by category, search by name, and sort the catalog.
- View product images, descriptions, prices, ratings, and stock details.
- Browse the catalog with 12 products per page.
- Add products to the bag or use **Buy now** to check out that product without including items already in the bag.
- Save products to a wishlist.
- Apply eligible coupon codes during checkout.
- Save personal information and a default delivery address for checkout.
- Track order progress, cancel eligible orders before shipping, and write or edit a review after delivery.
- Switch between light and dark themes.

### Admin dashboard

- View sales totals, delivered sales, open orders, product counts, and sales history.
- Update order statuses and review order information.
- Create, edit, and delete products, including uploading product images.
- Create and manage coupons, including discount rules, minimum order values, usage limits, and active dates.
- View, search, and browse registered user accounts.

### System and database

- Customer and administrator accounts with role-based access.
- MongoDB collections for users, products, carts, orders, coupons, and reviews.
- Server-side inventory updates during checkout and order cancellation.
- Passwords are stored as hashes; protected API requests use JSON Web Tokens.
- Responsive layouts for desktop, tablet, and mobile screens.

### Database handoff

The repository contains the database models and optional demo seed scripts, but it does **not** contain database records. Those records live in the MongoDB database named by `MONGODB_URI`. Giving someone the source files or GitHub repository does not automatically give them your current users, products, orders, coupons, or reviews.

For a client handoff, choose one of these approaches:

- **Use the same live database:** set the backend's `MONGODB_URI` to a database both deployments can reach. Keep the connection string and `JWT_SECRET` out of GitHub; configure them privately on the backend host.
- **Give them a copy of the current records:** export the database with MongoDB Database Tools (`mongodump`) and have the client restore it with `mongorestore` into their own database. Transfer the dump securely because it may contain account and order information.
- **Start with sample data:** run the seed scripts below against the client's database. These create demo records; they do not copy your current database.

The `.env.example` files show the required variable names without exposing credentials. The real `server/.env` stays local and should not be pushed to GitHub.

## Technology Stack

- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Node.js, Express
- **Database:** MongoDB with Mongoose
- **Authentication:** JSON Web Tokens and bcrypt

## Run Locally

### Requirements

- Node.js and npm
- MongoDB running locally or a MongoDB connection string

### 1. Configure and start the API

Open a terminal in `server`, install the packages, and create a file named `.env` in that folder:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/skyshop
JWT_SECRET=replace-this-with-a-long-random-secret-at-least-24-characters
CLIENT_ORIGIN=http://localhost:5173
```

Start the API:

```bash
npm install
npm run dev
```

### 2. (Optional) Add demo data

In another terminal, from the `server` folder, run the seed scripts you need:

```bash
npm run seed:demo
npm run seed:products
npm run seed:coupons
```

The demo seed adds sample products, customer accounts, carts, and orders without clearing existing collections.

To create an administrator account, add these optional values to `server/.env` and run `npm run create-admin` from `server`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-strong-password-at-least-12-characters
ADMIN_FIRST_NAME=Store
ADMIN_LAST_NAME=Admin
```

### 3. Start the website

In a third terminal:

```bash
cd client
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`. The frontend uses `http://localhost:5000/api` by default. To use a different API address, set `VITE_API_URL` for the client.

## Useful Commands

Run these from the relevant folder:

| Folder | Command | Purpose |
| --- | --- | --- |
| `client` | `npm run dev` | Start the Vite development server |
| `client` | `npm run build` | Create a production frontend build |
| `server` | `npm run dev` | Start the API with automatic reload |
| `server` | `npm start` | Start the API normally |
| `server` | `npm run create-admin` | Create or update an administrator account |

