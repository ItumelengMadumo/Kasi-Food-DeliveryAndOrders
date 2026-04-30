# Kasi Food Delivery 🍔🚀

A distributed commerce platform for informal markets in South Africa, designed to support vendor-managed menus, customer checkout, WhatsApp ordering, payment tracking, and an AWS-native backend built around AppSync, DynamoDB, Lambda, and React.

---

## System Architecture

```
App (React)  →  AWS AppSync (GraphQL)  →  DynamoDB (direct resolvers)
                                        →  Lambda (orders, delivery, payments, WhatsApp)
                                        →  S3 (images / proof uploads)
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

## Current State

The project is currently in an advanced prototype / partial integration stage.

### What exists today

- React frontend with customer, vendor, and admin screens
- AWS-oriented backend structure for AppSync, DynamoDB, and Lambda
- Menu browsing and cart flow on the customer side
- Vendor menu creation flow in the frontend
- Vendor dashboard for viewing orders and updating order progress
- WhatsApp webhook Lambda with a working multi-step ordering session flow
- DynamoDB single-table design for vendors, menu items, orders, order items, reviews, and WhatsApp sessions
- Manual payment-state support through a mark-paid mutation
- Vendor WhatsApp number support and vendor lookup by WhatsApp number

### What is partially implemented

- AppSync schema covers more operations than the current resolver folder implements
- Frontend API layer expects mutations and queries that are not all wired in AppSync yet
- Vendor settings include EFT proof tracking, but this is currently frontend-only and stored in local browser storage
- Real-time order updates are designed via GraphQL subscriptions, but WhatsApp-created orders currently bypass the AppSync mutation path
- Banking details are modeled in TypeScript and DynamoDB patterns, but are not consistently exposed across GraphQL responses

### What is not production-ready yet

- Vendor identity is not fully normalized between frontend auth and backend vendor records
- Menu edit and availability toggle flows are not fully backed by resolver coverage
- Customer order history and detailed order retrieval are not fully implemented in AppSync
- EFT proof ingestion from WhatsApp is not yet a backend feature
- Guest, customer, vendor, and admin auth flows still need production Cognito setup
- Amplify/AppSync/Cognito environment configuration still uses placeholders

### Practical summary

Today, the codebase proves the product direction and already contains important core logic, especially for order capture and WhatsApp-driven ordering. It should be treated as a foundation for the production build rather than a finished deployment candidate.

---

## Finished Product Vision

The intended finished product is a township-focused food commerce platform where vendors can manage menus, accept orders from both the web app and WhatsApp, track order progress in real time, receive EFT proof submissions in a dedicated proof-review workspace, and operate on a secure AWS backend with clear operational visibility.

### Target end-state capabilities

- Customers can browse vendors and menus from the web app
- Customers can place one order containing multiple menu items through either web checkout or WhatsApp
- Vendors can add, edit, hide, and organize menu items with changes saved immediately and reflected everywhere
- WhatsApp orders and web orders are stored through the same domain model and appear in the same dashboard
- Order statuses are persisted and reflected consistently across customer, vendor, admin, and notification flows
- EFT orders can receive proof of payment through WhatsApp media ingestion or manual back-office review
- EFT proofs appear on a dedicated page, separate from vendor settings, with review states such as pending, verified, and flagged
- Vendors can manage banking details, delivery settings, and contact details safely
- Admins can approve vendors, monitor orders, handle disputes, and oversee platform operations
- The platform supports observability, retries, idempotency, and secure secret management for production AWS usage

---

## DynamoDB — Single Table Design

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

## Current Delivery Gaps

The main work remaining is not broad UI scaffolding. It is backend contract completion and consistency.

### Highest-priority gaps

- Unify vendor identity across Cognito users, vendor records, frontend state, and DynamoDB keys
- Complete missing AppSync resolvers for frontend operations already in use
- Align GraphQL schema, Lambda-written order fields, and frontend types
- Route WhatsApp-created orders into the same observable order lifecycle as web-created orders
- Replace local EFT proof storage with DynamoDB metadata plus S3 file storage
- Create a standalone EFT proof management page and route
- Add proper production environment setup for Cognito, AppSync, API Gateway, Lambda, S3, and secrets

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

## Delivery Plan

The recommended build order is to stabilize the domain contract first, then complete backend coverage, then finish channel-specific features such as WhatsApp proof ingestion.

### Phase 1 — Foundation Alignment

Goal: make the existing app coherent enough to become a reliable delivery baseline.

Scope:

- Normalize vendor identity across auth, frontend state, GraphQL, and DynamoDB
- Align TypeScript types, GraphQL schema, and Lambda order fields
- Replace silent demo fallbacks in critical save flows with explicit failure handling
- Define environment strategy for dev, staging, and production

AWS services:

- Amazon Cognito
- AWS AppSync
- Amazon DynamoDB
- AWS Secrets Manager
- Amazon CloudWatch

Estimated build order inside phase:

1. Finalize vendor and user identity model
2. Finalize GraphQL contracts for Vendor, Order, MenuItem, and payment fields
3. Configure environments and secrets
4. Add logging and baseline alarms

### Phase 2 — Core AppSync Completion

Goal: ensure the frontend screens already present in the app are backed by real, production-capable APIs.

Scope:

- Implement missing AppSync queries and mutations
- Complete menu edit, toggle, customer order history, order detail, vendor profile, and bank details operations
- Ensure admin operations are fully wired
- Validate end-to-end persistence for menu items and order status changes

AWS services:

- AWS AppSync
- Amazon DynamoDB
- AWS Lambda where direct resolver logic is not sufficient

Estimated build order inside phase:

1. Menu update and availability mutations
2. Vendor profile and bank detail mutations
3. Customer order history and order detail queries
4. Admin order and review operations
5. End-to-end validation for vendor and customer flows

### Phase 3 — Unified Order Lifecycle

Goal: make web orders and WhatsApp orders behave like one system.

Scope:

- Ensure both order channels produce the same order shape
- Make subscriptions and dashboard updates consistent for all order sources
- Persist order source, payment status, and lifecycle transitions uniformly
- Add idempotency and retry-safe order processing patterns

AWS services:

- AWS Lambda
- Amazon DynamoDB
- AWS AppSync
- Amazon EventBridge or Amazon SQS
- Amazon CloudWatch

Estimated build order inside phase:

1. Standardize order creation contract
2. Add eventing between order creation and notifications
3. Align vendor dashboard, customer order tracking, and subscriptions
4. Add retry and idempotency protection

### Phase 4 — WhatsApp Commerce Productionization

Goal: turn the WhatsApp ordering prototype into a supported production channel.

Scope:

- Harden Twilio webhook handling
- Improve session recovery and timeout handling
- Add vendor-specific WhatsApp routing and validation
- Add order confirmation, failure handling, and operational dashboards

AWS services:

- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- AWS Secrets Manager
- Amazon CloudWatch

Estimated build order inside phase:

1. Secure webhook validation and secrets setup
2. Session durability and recovery rules
3. Production notification and failure handling
4. Operational monitoring for WhatsApp traffic

### Phase 5 — EFT Proofs and Payment Operations

Goal: move EFT proof handling out of vendor settings and into a real operational workflow.

Scope:

- Create a dedicated EFT proofs page and route
- Store proof metadata in DynamoDB
- Store proof files in S3
- Ingest WhatsApp media attachments and associate them to EFT orders
- Add review actions and proof states: pending review, verified, flagged

AWS services:

- Amazon S3
- Amazon DynamoDB
- AWS Lambda
- Amazon API Gateway
- AWS AppSync

Estimated build order inside phase:

1. Add proof entity design to schema and database model
2. Create proof upload and storage pattern in S3
3. Build proof-review page and vendor/admin workflows
4. Connect WhatsApp attachment ingestion
5. Add proof-to-order matching and audit trail

### Phase 6 — Payments, Payouts, and Reconciliation

Goal: complete the commercial flow for digital and EFT payments.

Scope:

- Integrate PayFast or Ozow for supported vendors
- Support EFT reference matching and manual reconciliation where needed
- Record payment states separately from order states
- Build payout-ready reporting for vendors and platform admins

AWS services:

- AWS Lambda
- Amazon DynamoDB
- AWS AppSync
- Amazon EventBridge
- Amazon S3 for exports if needed

Estimated build order inside phase:

1. Digital payment gateway integration
2. Payment state model and reconciliation logic
3. Vendor payout reporting
4. Admin finance visibility

### Phase 7 — Production Readiness and Scale

Goal: prepare the platform for real operators, real vendors, and real customer traffic.

Scope:

- Add CI/CD and infrastructure deployment workflows
- Add staging and production environments
- Add security reviews, backups, and operational runbooks
- Add analytics, support tooling, and cost monitoring

AWS services:

- AWS CDK or AWS Amplify deployment workflows
- Amazon CloudWatch
- AWS IAM
- AWS Backup where required
- AWS Budgets

Estimated build order inside phase:

1. Infrastructure-as-code and environment promotion
2. Monitoring, alarms, and dashboards
3. Security hardening and access controls
4. Cost controls and operations playbooks

---

## Recommended AWS Service Map

| Capability | Recommended AWS Service |
|-----------|--------------------------|
| Frontend API | AWS AppSync |
| Authentication | Amazon Cognito |
| Primary data store | Amazon DynamoDB |
| WhatsApp webhook ingestion | Amazon API Gateway + AWS Lambda |
| Order domain logic | AWS Lambda |
| EFT proof files | Amazon S3 |
| Async order and payment events | Amazon EventBridge or Amazon SQS |
| Secrets and tokens | AWS Secrets Manager |
| Logs, metrics, alarms | Amazon CloudWatch |

---

## Recommended Build Order Summary

If this project is being taken from prototype to product, the practical build order should be:

1. Identity and contract alignment
2. Missing AppSync resolver coverage
3. Unified order lifecycle across web and WhatsApp
4. Production WhatsApp hardening
5. Dedicated EFT proof workflow and page
6. Payment gateway and reconciliation features
7. Production operations, security, and scale

This sequence reduces rework. It avoids building more interface features on top of backend contracts that are still drifting.

---

## Roadmap Snapshot

- [x] Core architecture direction
- [x] DynamoDB single-table model
- [x] Frontend app shell and major screens
- [x] WhatsApp order session prototype
- [ ] Identity normalization across frontend and backend
- [ ] Complete AppSync resolver coverage
- [ ] Unified web + WhatsApp order lifecycle
- [ ] Dedicated EFT proof management page
- [ ] WhatsApp proof/media ingestion
- [ ] Production Cognito and environment setup
- [ ] Digital payment gateway integration
- [ ] Production monitoring, security, and deployment workflows