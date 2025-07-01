# 📦 Invenage – Inventory Management WebApp (Production, Real-Time, No Mock Data)

---

## ✅ Core Modules

1. **Authentication**

   * Sign Up / Login (Email, Google, OTP)
   * Role-based Access: Admin, Manager, Staff

2. **Dashboard**

   * KPIs: Total Stock, Sales Today, Low Stock Alerts
   * Graphs: Stock Movement, Sales Trends
   * Quick Actions: Add Item, Add Order, Receive Stock

3. **Inventory Management**

   * Product List:

     * Product Name, SKU, Barcode, Quantity, Unit Cost, Location, Total Value
   * Features:

     * Add/Edit/Delete Items
     * Real-Time Stock Updates
     * Image Upload
     * Category and Location Management
     * Import/Export CSV

4. **Stock Movement**

   * Stock In (Purchase)
   * Stock Out (Sales)
   * Stock Transfers (Between Locations)
   * Stock Adjustments (Damages, Corrections)

5. **Order Management**

   * Sales Orders: Draft, Issued, Shipped, Completed
   * Purchase Orders: Draft, Issued, Received, Completed
   * Linked Customers and Suppliers

6. **Customer & Supplier Management**

   * Contact Information
   * Purchase/Sales History
   * Outstanding Payments

7. **Billing & Invoicing**

   * Invoice Generation
   * Payment Tracking (Partial, Full)
   * Download/Email Invoice PDF
   * Multi-Currency Support

8. **Reports & Analytics**

   * Inventory Summary
   * Stock Movement Report
   * Sales by Product/Category
   * Custom Date Filtering
   * Export as CSV/PDF

9. **User Management**

   * Role-Based Permissions
   * Activity Logs
   * Password Reset

---

## 🛠️ Tech Stack

| Layer          | Tech Stack                                 |
| -------------- | ------------------------------------------ |
| Frontend       | Next.js + Tailwind + Redux                 |
| Backend        | Node.js + Express.js                       |
| Real-Time Sync | WebSockets (Socket.IO)                     |
| Database       | PostgreSQL                                 |
| Authentication | JWT + OAuth                                |
| File Storage   | AWS S3                                     |
| Deployment     | Vercel (Next.js), Render/Heroku (Backend)  |
| CDN            | Cloudflare                                 |

---

## 📂 Folder Structure

```
invenage/
├── client/ (Next.js Frontend)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── orders/
│   │   └── settings/
│   ├── components/
│   ├── lib/
│   │   ├── redux/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   └── public/
└── server/ (Node.js Backend)
    ├── controllers/
    ├── routes/
    ├── models/
    ├── utils/
    ├── middleware/
    └── app.js
```

---

## 🔁 Real-Time Data Flow

* **WebSocket Channels:**

  * Stock Updates
  * Order Status Changes
  * Notifications (Low Stock, New Order, Payment Alerts)

* **API Communication:**

  * Direct real-time sync with PostgreSQL (no mock data)
  * Optimistic UI updates for smooth user experience

---

## 🗂️ Page Structure

| Page                | Features                                  |
| ------------------- | ----------------------------------------- |
| Login / Signup      | OAuth, JWT, Role-based Access             |
| Dashboard           | KPIs, Stock Graphs, Quick Actions         |
| Inventory           | Product List, Filters, Live Stock Updates |
| Stock Movement      | Inflow, Outflow, Transfers, Adjustments   |
| Orders              | Sales & Purchase Order Tracking           |
| Customers/Suppliers | Details, History, Quick Contact           |
| Billing             | Invoice Generation, Payments              |
| Reports             | Downloadable, Filterable Reports          |
| Settings            | User Management, Preferences              |

---

## 🔗 Example System Flow: Sales Order

1. **Create Order → Select Customer → Add Products → Confirm Order**
2. **Stock Deducted Instantly (WebSocket Broadcast)**
3. **Invoice Generated → Payment Processed → Order Completed**

---

## 📃 API Contracts (Sample)

| Endpoint           | Method | Description              |
| ------------------ | ------ | ------------------------ |
| /api/auth/login    | POST   | Login                    |
| /api/products      | GET    | Fetch all products       |
| /api/products      | POST   | Add new product          |
| /api/products/\:id | PUT    | Update product           |
| /api/products/\:id | DELETE | Delete product           |
| /api/orders        | POST   | Create order             |
| /api/orders/\:id   | PUT    | Update order status      |
| /api/customers     | GET    | Fetch customer list      |
| /api/reports/stock | GET    | Inventory summary report |

---

## 🛡️ User Roles & Permissions

* **Admin:** Full Access
* **Manager:** Inventory, Orders, Reports
* **Staff:** View Only / Limited Actions

---

## ⚡ Key Components

* **Dynamic Tables:** Sort, Filter, Paginate
* **Searchable Dropdowns:** Product & Customer selection
* **Modal Forms:** For CRUD operations
* **Charts:** Stock & Sales Graphs
* **Real-Time Notifications:** WebSocket-based
* **PDF Generation:** Invoices and Reports

# Invenage - Detailed UI Wireframes and Layout Plan

---

## 1. Authentication Pages

### Login Page

* **Form Fields:**

  * Email
  * Password
* **Buttons:**

  * Login
  * Google OAuth Login
  * Forgot Password
* **Redirect Link:** Signup page

### Signup Page

* **Form Fields:**

  * Name
  * Email
  * Password
  * Role selection (if allowed)
* **Buttons:**

  * Sign Up
  * Google OAuth Sign Up
* **Redirect Link:** Login page

---

## 2. Dashboard Page

### Header

* Company Logo (Left)
* Notifications (Right)
* User Profile Dropdown (Right)

### Sidebar

* Dashboard, Inventory, Stock, Orders, Customers, Suppliers, Billing, Reports, Settings

### Main Section

* **Top Row KPIs:**

  * Total Products
  * Total Stock Value
  * Sales Today
  * Low Stock Alerts

* **Middle Section:**

  * Stock Movement Graph
  * Sales Trends Graph

* **Bottom Section:**

  * Recent Orders Table
  * Recent Stock Changes Table

---

## 3. Inventory Page

### Top Controls

* Search Bar
* Filters (Category, Location, Stock Level)
* Add Product Button
* Import/Export CSV Button

### Inventory Table Columns

* Image
* Product Name
* SKU
* Quantity
* Unit Cost
* Total Value
* Action Buttons (Edit, Delete)

---

## 4. Stock Movement Page

### Top Tabs

* Stock In (Purchase)
* Stock Out (Sales)
* Transfers
* Adjustments

### Shared Table Layout

* Date
* Product Name
* Quantity
* Type (In/Out/Transfer/Adjustment)
* Reference ID
* Action Button (View Details)

### Add Stock Movement Form (Modal)

* Select Type
* Select Product
* Quantity
* Reference Notes
* Save Button

---

## 5. Orders Page

### Top Controls

* Sales Orders Tab
* Purchase Orders Tab
* Add Order Button
* Search Bar

### Order Table Columns

* Order ID
* Customer/Supplier
* Date
* Status (Draft, Issued, Shipped, Completed)
* Total Amount
* Action Buttons (View, Edit)

### Order Creation Modal

* Select Customer/Supplier
* Add Products (Searchable Dropdown)
* Set Quantities
* Apply Discounts (Optional)
* Save as Draft or Issue Order

---

## 6. Customer/Supplier Page

### Shared Table Layout

* Name
* Contact Info (Phone, Email)
* Total Transactions
* Outstanding Payments
* Action Buttons (View, Edit)

### Customer/Supplier Detail Page

* Contact Information
* Transaction History Table
* Outstanding Balances
* Quick Action: Send Email/Message

---

## 7. Billing & Invoicing Page

### Invoice Table

* Invoice ID
* Customer/Supplier
* Date
* Amount
* Payment Status (Pending, Partial, Paid)
* Action Buttons (Download PDF, Email)

### Invoice Detail View

* Invoice PDF Viewer
* Download Button
* Email Invoice Button
* Payment Update Form

---

## 8. Reports Page

### Filters

* Date Range Picker
* Report Type Dropdown (Stock Summary, Sales, Purchases)

### Report Table

* Dynamically updates based on filters
* Export Button (CSV, PDF)

### Charts

* Stock Movement Graph
* Sales by Category Pie Chart

---

## 9. Settings Page

### Tabs

* User Management
* App Preferences
* Activity Logs

### User Management Table

* Name
* Email
* Role
* Action Buttons (Edit, Remove)

### Add User Modal

* Name, Email, Password, Role

### Preferences

* Currency
* Company Logo Upload
* Default Notification Settings

---

## Key UI Components

* Searchable Dropdowns
* Modal Forms
* Pagination and Sorting for All Tables
* Toast Notifications for Real-Time Updates
* WebSocket Integration for Live Stock Changes