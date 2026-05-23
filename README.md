# StackReserve - Concurrency-Safe Inventory Reservation System

A production-ready full-stack checkout inventory reservation system built with Next.js 15 App Router, TypeScript, Prisma ORM, PostgreSQL (Neon), and TailwindCSS.

> **Design Goal**: Core inventory consistency and absolute correctness under high concurrency are prioritized over raw database write throughput. The system guarantees that simultaneous checkout requests for the final unit of stock cannot both succeed.

---

## 1. Project Overview & Features

When a customer initiates a checkout session, stock is temporarily held for a limited window (e.g., 10 minutes) before payment is finalized. This system manages these holds dynamically and safely.

- **Multi-Warehouse Stock Mapping**: Track inventory per product per warehouse.
- **Pessimistic Row Locking**: Protects stock allocation from race conditions.
- **Dynamic Lazy Expiration**: Expired reservations are automatically released on-access (lazy evaluation) and returned to available stock levels.
- **Checkout Confirmation / Release**: Atomically deducts total inventory upon purchase completion, or restores available stock upon cancellation.
- **Live Countdown Timer**: Client-side countdown display matching the reservation expiration window.
- **Full Type Safety**: Integrated runtime validation and static typings using Zod.

---

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router, Server & Client Components)
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Prisma ORM (v5)
- **Language**: TypeScript (Strict Mode)
- **Styling**: TailwindCSS (v3)
- **Validation**: Zod

---

## 3. Project Structure

- `/app` — App router pages, layouts, and API endpoints.
- `/app/api` — Route handlers managing database locking and checkout updates.
- `/components` — Client-side interactive components (inventories list, countdown timer, actions).
- `/lib` — Singleton Prisma client.
- `/prisma` — Prisma schema and data seeding script.
- `/types` — Shared validation schemas and TypeScript types.

---

## 4. Architecture Decisions

- **Why PostgreSQL?**
  PostgreSQL provides robust ACID compliance and row-level locking operations (`SELECT FOR UPDATE`), which are required to enforce transactional invariants during high concurrent checkout volumes.
- **Why Pessimistic Locking?**
  Optimistic locking (e.g. version checks) can result in high abort/retry rates under heavy contention for the same product unit. Pessimistic locking blocks concurrent requests at the database engine level, guaranteeing immediate success/failure resolution.
- **Why Prisma Interactive Transactions?**
  Prisma transactions encapsulate the row lock, stock check, inventory increment/decrement, and reservation creation, ensuring all operations either succeed together or roll back completely on failure.

---

## 5. Concurrency Safety (SELECT ... FOR UPDATE)

### How It Works:
1. **Interactive Transaction Begins**: An isolated query session is opened.
2. **Obtain Row Lock**: The database locks the matching `Inventory` row:
   ```sql
   SELECT id, "totalStock", "reservedStock"
   FROM "Inventory"
   WHERE "productId" = $1 AND "warehouseId" = $2
   LIMIT 1
   FOR UPDATE
   ```
   *Any concurrent transaction attempting to read/write this row for update blocks here until our transaction commits or aborts.*
3. **Verify Stock**: Calculate `availableStock = totalStock - reservedStock`. If insufficient, return `409 Conflict`.
4. **Update Stock**: Increment/decrement `reservedStock` atomically, asserting that inventory totals never go below 0.
5. **Create/Update Reservation**: Insert the `Reservation` record with the expiration timestamp.
6. **Transaction Commits**: The lock is released, and subsequent queued transactions proceed with the updated stock values.

---

## 6. Reservation Expiry Strategy

- **Duration**: Checkout reservations are held for 10 minutes.
- **Lazy Cleanup**: Expired `pending` reservations are automatically resolved on-access:
  - Hitting `GET /api/reservations/[id]` checks if the reservation is expired.
  - If expired, it opens a transaction, locks the inventory row, decrements `reservedStock`, updates status to `released`, and returns the updated state.
- **Production Alternatives**:
  - **Vercel Cron**: Scheduled functions cleaning expired sessions every minute.
  - **Background Worker**: Redis-based task queue (e.g. BullMQ) triggering cleanups at specific timestamps.
  - **Message Queues**: RabbitMQ/SQS dead-letter exchange bindings.

---

## 7. API Endpoints Summary

| Method | Route | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/products` | Retrieve products, warehouse stock levels, and available stock. |
| **GET** | `/api/warehouses` | Retrieve all warehouses. |
| **POST** | `/api/reservations` | Create a pending reservation using row-level locking. |
| **GET** | `/api/reservations/[id]` | Fetch reservation details; auto-releases reservation if expired. |
| **POST** | `/api/reservations/[id]/confirm` | Confirm purchase; deducts both `totalStock` and `reservedStock`. |
| **POST** | `/api/reservations/[id]/release` | Cancel reservation; releases reserved stock back to available. |

---

## 8. UI Screenshots

### Home Page
*(Lists products, warehouse details, stock totals, and reservation triggers).*
`[ Placeholder: Insert Home Page inventory card view screenshot here ]`

### Reservation Details Page
*(Displays active countdown timer, cancel controls, and purchase confirmation).*
`[ Placeholder: Insert Reservation Checkout Details view screenshot here ]`

---

## 9. Environment Variables

Create a `.env` file in the root directory:
```env
# Neon PostgreSQL Connection URL
DATABASE_URL="postgresql://username:password@localhost:5432/inventory_db?schema=public"
```

---

## 10. Setup Instructions

### Local Development Setup:
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
3. **Push Database Schema**:
   ```bash
   npx prisma db push
   ```
4. **Seed Database**:
   ```bash
   npm run seed
   ```
5. **Run Development Server**:
   ```bash
   npm run dev
   ```

---

## 11. Deployment Setup (Vercel + Neon)

### Neon PostgreSQL Setup:
1. Create a project on [Neon](https://neon.tech/).
2. Copy the Connection String from your dashboard.
3. Replace the `DATABASE_URL` in your `.env` file.

### Vercel Deployment:
1. Import your repository into **Vercel**.
2. Add the `DATABASE_URL` environment variable under Project Settings.
3. Configure the build command or run migrations against your production database using `npx prisma db push`.
4. Deploy the application.

---

## 12. Tradeoffs & Future Scope

### Tradeoffs:
- **Simplicity over Distributed Queues**: Interactive transactions on a single PostgreSQL instance were chosen for transactional safety without introducing infrastructure overhead (like Redis/Kafka).
- **Lazy Cleanup**: Auto-releasing on fetch reduces background worker costs but depends on users or API requests hitting the endpoint to clean up database stock.

### Future Improvements:
- **Distributed Locks**: Use Redis-based locks (Redlock) for faster caching and session limits.
- **Idempotency Keys**: Block double-submissions at the API gateway layer using UUID headers.
- **Background Cleanup Workers**: Integrate background task processors for deterministic cleanup.
- **Real-time WebSockets**: Push live inventory updates to the home UI when other checkouts complete.
