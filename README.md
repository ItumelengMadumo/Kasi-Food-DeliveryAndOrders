# Kasi Food Delivery 🍔🚀

A distributed commerce platform for informal markets in South Africa — built on AWS AppSync (GraphQL), DynamoDB, Lambda, and React.

---

## System Architecture

```
App (React)  →  AWS AppSync (GraphQL)  →  DynamoDB (direct resolvers)
                                        →  Lambda (orders, delivery, payments)
                                        →  S3 (images)
Auth: Amazon Cognito  |  Payments: PayFast / Ozow / EFT / Cash
```

---

## Project Structure

```
Kasi-Food-Delivery/
├── infra/                        # Backend infrastructure
│   ├── appsync/
│   │   ├── schema.graphql        # Full GraphQL schema
│   │   └── resolvers/            # AppSync VTL / JS resolvers
│   ├── dynamodb/
│   │   └── tables.json           # DynamoDB table definitions
│   └── lambda/
│       ├── createOrder/          # Order creation logic
│       ├── calculateDelivery/    # Delivery fee calculation
│       ├── processPayment/       # Payment processing
│       └── updateOrderStatus/    # Order status updates
└── frontend/                     # React + TypeScript frontend
    └── src/
        ├── modules/              # Business logic modules
        │   ├── auth/
        │   ├── vendor/
        │   ├── customer/
        │   └── orders/
        ├── components/           # Shared UI components
        ├── screens/              # Page-level components
        │   ├── Home/
        │   ├── VendorDetails/
        │   ├── Cart/
        │   ├── Checkout/
        │   ├── Orders/
        │   ├── Vendor/           # Vendor dashboard
        │   └── Admin/            # Admin dashboard
        ├── services/             # API & AppSync client
        └── state/                # Zustand stores
```

---

## Core Modules

| Module | Description |
|--------|-------------|
| **Auth** | Cognito-backed registration/login + guest checkout |
| **Vendor** | Onboarding, menu management, order handling |
| **Customer** | Browse, cart, checkout (guest or registered), tracking |
| **Order** | Full lifecycle: PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED |
| **Payment** | Banked vendors (digital) vs non-banked (cash on delivery) |
| **Delivery** | Vendor-configured: PERCENTAGE or FLAT fee |

---

## DynamoDB — Single Table Design

**Table: `KasiMainTable`**

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `PROFILE` |
| Vendor | `VENDOR#<id>` | `PROFILE` |
| Menu Item | `VENDOR#<id>` | `MENU#<itemId>` |
| Order | `ORDER#<id>` | `METADATA` |
| Order Items | `ORDER#<id>` | `ITEM#<itemId>` |
| Review | `VENDOR#<id>` | `REVIEW#<reviewId>` |

**GSIs:**
- `GSI1` — Orders by Vendor: `VENDOR#<id>` / `ORDER#<createdAt>`
- `GSI2` — Orders by Customer: `USER#<id>` / `ORDER#<createdAt>`

---

## Key User Roles

- **CUSTOMER** — Browse, cart, checkout (guest or registered)
- **VENDOR** — Manage menu, hours, accept/reject orders
- **ADMIN** — Approve vendors, manage disputes, view all orders

---

## Payment Model

| Vendor Type | Flow |
|------------|------|
| Has bank account | Customer pays digitally → platform takes commission → vendor payout |
| No bank account | Customer pays on delivery/pickup → platform charges admin fee per order |

---

## Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured
- AWS Amplify CLI (`npm i -g @aws-amplify/cli`)

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Infrastructure
Deploy via AWS CDK or Amplify CLI (see `infra/` for schema and table definitions).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | AWS AppSync (GraphQL) |
| Auth | Amazon Cognito |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 |
| Compute | AWS Lambda (Node.js 18) |
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| Styling | Tailwind CSS |
| Payments | PayFast / Ozow / EFT |

---

## Roadmap

- [x] Core architecture design
- [x] GraphQL schema
- [x] DynamoDB single-table model
- [x] Lambda function scaffolds
- [x] React frontend (all screens)
- [ ] Cognito integration (production)
- [ ] AppSync resolver deployment
- [ ] Payment gateway integration (PayFast/Ozow)
- [ ] Push notifications
- [ ] Driver/logistics module
- [ ] Grocery & services expansion