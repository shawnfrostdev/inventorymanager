# 📋 Inventory Management System - API Documentation

## 🌐 Base URL
```
Development: http://localhost:5000
Production: https://your-domain.com
```

## 🔐 Authentication

The API uses JWT (JSON Web Token) authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer <your-access-token>
```

### Token Lifecycle
- **Access Token**: Valid for 1 hour
- **Refresh Token**: Valid for 7 days
- Use refresh tokens to obtain new access tokens without re-login

---

## 🚀 API Endpoints

### 🔑 Authentication Endpoints

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account."
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

#### Verify Email
```http
POST /api/auth/verify-email
```

**Request Body:**
```json
{
  "token": "verification-token-from-email"
}
```

#### Forgot Password
```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

#### Logout
```http
POST /api/auth/logout
```

---

### 📦 Product Management

#### Get All Products
```http
GET /api/products?page=1&limit=10&search=phone&categoryId=cat-id
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term
- `categoryId` (optional): Filter by category

**Response (200):**
```json
{
  "success": true,
  "products": [
    {
      "id": "product-id",
      "name": "iPhone 14",
      "description": "Latest iPhone model",
      "sku": "IPH-14-001",
      "price": 999.99,
      "cost": 600.00,
      "quantity": 50,
      "minQuantity": 10,
      "categoryId": "category-id",
      "category": {
        "id": "category-id",
        "name": "Electronics"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Get Product by ID
```http
GET /api/products/:id
```

**Response (200):**
```json
{
  "success": true,
  "product": {
    "id": "product-id",
    "name": "iPhone 14",
    "description": "Latest iPhone model",
    "sku": "IPH-14-001",
    "price": 999.99,
    "cost": 600.00,
    "quantity": 50,
    "minQuantity": 10,
    "categoryId": "category-id",
    "category": {
      "id": "category-id",
      "name": "Electronics",
      "description": "Electronic devices"
    },
    "inventoryMovements": [
      {
        "id": "movement-id",
        "quantity": -2,
        "type": "SALE",
        "notes": "Sold to customer",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Create Product
```http
POST /api/products
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "sku": "PROD-001",
  "price": 99.99,
  "cost": 50.00,
  "quantity": 100,
  "minQuantity": 10,
  "categoryId": "category-id"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "product": {
    "id": "new-product-id",
    "name": "New Product",
    "sku": "PROD-001",
    "price": 99.99,
    "cost": 50.00,
    "quantity": 100,
    "minQuantity": 10
  }
}
```

#### Update Product
```http
PUT /api/products/:id
```

**Request Body:**
```json
{
  "name": "Updated Product Name",
  "price": 109.99,
  "quantity": 80
}
```

#### Delete Product
```http
DELETE /api/products/:id
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

#### Update Inventory
```http
POST /api/products/:id/inventory
```

**Request Body:**
```json
{
  "quantity": -5,
  "type": "SALE",
  "notes": "Sold to customer John"
}
```

**Movement Types:**
- `PURCHASE` - Inventory received
- `SALE` - Inventory sold
- `ADJUSTMENT` - Manual adjustment
- `RETURN` - Customer return
- `DAMAGE` - Damaged goods
- `TRANSFER` - Transfer between locations

#### Get Low Stock Products
```http
GET /api/products/low-stock
```

---

### 🛒 Order Management

#### Get All Orders
```http
GET /api/orders?page=1&limit=10&status=PENDING
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `status`: Filter by order status
- `customerId`: Filter by customer
- `startDate`, `endDate`: Date range filter

**Response (200):**
```json
{
  "success": true,
  "orders": [
    {
      "id": "order-id",
      "orderNumber": "ORD-2024-001",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "subtotal": 199.98,
      "taxAmount": 16.00,
      "total": 215.98,
      "customer": {
        "id": "customer-id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "items": [
        {
          "id": "item-id",
          "quantity": 2,
          "price": 99.99,
          "product": {
            "id": "product-id",
            "name": "iPhone 14",
            "sku": "IPH-14-001"
          }
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Order
```http
POST /api/orders
```

**Request Body:**
```json
{
  "customerId": "customer-id",
  "items": [
    {
      "productId": "product-id",
      "quantity": 2,
      "price": 99.99
    }
  ],
  "notes": "Urgent delivery",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

#### Update Order Status
```http
PUT /api/orders/:id/status
```

**Request Body:**
```json
{
  "status": "CONFIRMED",
  "paymentStatus": "PAID"
}
```

**Order Statuses:**
- `PENDING` - Order placed, awaiting confirmation
- `CONFIRMED` - Order confirmed
- `PROCESSING` - Order being prepared
- `SHIPPED` - Order shipped
- `DELIVERED` - Order delivered
- `CANCELLED` - Order cancelled

**Payment Statuses:**
- `PENDING` - Payment pending
- `PAID` - Payment completed
- `FAILED` - Payment failed
- `REFUNDED` - Payment refunded

---

### 👥 Customer Management

#### Get All Customers
```http
GET /api/customers?page=1&limit=10&search=john
```

#### Create Customer
```http
POST /api/customers
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-0123",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA"
}
```

---

### 📊 Analytics & Reports

#### Get All KPIs
```http
GET /api/reports/kpis/all
```

**Response (200):**
```json
{
  "success": true,
  "kpis": {
    "totalRevenue": {
      "value": 125000.50,
      "change": 15.2,
      "trend": "up"
    },
    "totalOrders": {
      "value": 1247,
      "change": 8.5,
      "trend": "up"
    },
    "activeCustomers": {
      "value": 234,
      "change": -2.1,
      "trend": "down"
    },
    "inventoryTurnover": {
      "value": 4.2,
      "change": 0.8,
      "trend": "up"
    },
    "lowStockItems": {
      "value": 12,
      "change": -25.0,
      "trend": "down"
    }
  }
}
```

#### Get Sales Analytics
```http
GET /api/reports/analytics/sales?period=month&startDate=2024-01-01&endDate=2024-01-31
```

**Query Parameters:**
- `period`: `day`, `week`, `month`, `quarter`, `year`
- `startDate`, `endDate`: Custom date range (ISO format)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 45000.00,
    "totalOrders": 156,
    "averageOrderValue": 288.46,
    "topProducts": [
      {
        "productId": "product-id",
        "name": "iPhone 14",
        "revenue": 12000.00,
        "quantity": 12
      }
    ],
    "salesByPeriod": [
      {
        "period": "2024-01-01",
        "revenue": 1500.00,
        "orders": 5
      }
    ]
  }
}
```

#### Get Inventory Analytics
```http
GET /api/reports/analytics/inventory
```

#### Get Customer Analytics
```http
GET /api/reports/analytics/customers
```

#### Generate Quick Report
```http
GET /api/reports/quick/:type/:period
```

**Report Types:**
- `sales` - Sales performance report
- `inventory` - Inventory status report
- `customers` - Customer analysis report
- `financial` - Financial summary report

---

## 🚨 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ],
  "code": "VALIDATION_ERROR"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_ERROR` | Invalid credentials |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `INSUFFICIENT_STOCK` | Not enough inventory |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## 🔄 Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **General endpoints**: 100 requests per minute
- **Report endpoints**: 20 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## 📡 Real-time Features

### WebSocket Connection
```javascript
const socket = io('http://localhost:5000');

// Join user room for personal notifications
socket.emit('join', { userId: 'your-user-id' });

// Listen for notifications
socket.on('notification', (data) => {
  console.log('New notification:', data);
});

// Listen for inventory alerts
socket.on('lowStock', (data) => {
  console.log('Low stock alert:', data);
});
```

### Available Events
- `notification` - General notifications
- `lowStock` - Low stock alerts
- `orderUpdate` - Order status changes
- `systemAlert` - System alerts

---

## 🧪 Testing the API

### Using cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get products with authentication
curl -X GET http://localhost:5000/api/products \
  -H "Authorization: Bearer your-access-token"
```

### Using Postman
1. Import the API collection (if available)
2. Set environment variables for base URL and tokens
3. Use the authentication endpoints to get tokens
4. Test other endpoints with proper authentication

### Rate Limit Testing
```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

---

## 📋 API Changelog

### Version 1.0.0 (Current)
- Initial API release
- Full CRUD operations for products, orders, customers
- Comprehensive analytics and reporting
- Real-time notifications
- JWT authentication
- Rate limiting

---

## 🤝 Support

For API support, please:
1. Check this documentation
2. Review the troubleshooting guide
3. Contact the development team

---

*Last updated: December 2024* 