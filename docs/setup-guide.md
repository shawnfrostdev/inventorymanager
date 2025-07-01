# 🚀 Inventory Management System - Setup Guide

## 📋 Overview

This guide will help you set up the Inventory Management System in both development and production environments. The system consists of a Node.js/Express backend API and a Next.js frontend application.

---

## 🏗️ System Architecture

```
Frontend (Next.js)     ←→     Backend (Node.js/Express)     ←→     Database (PostgreSQL)
    Port 3000                      Port 5000                         Port 5432
```

### Technology Stack

**Backend:**
- Node.js 18+ with Express.js
- TypeScript for type safety
- Prisma ORM for database management
- PostgreSQL database
- JWT authentication
- Redis for caching (optional)
- Socket.IO for real-time features

**Frontend:**
- Next.js 14 with React 18
- TypeScript
- Tailwind CSS for styling
- Redux Toolkit for state management
- React Query for API management

---

## ⚡ Quick Start (Development)

### Prerequisites

Ensure you have the following installed:
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **PostgreSQL**: Version 14.0 or higher
- **Git**: For version control

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/inventory-manager.git
cd inventory-manager
```

### 2. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit environment variables (see Configuration section)
nano .env

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database (optional)
npx ts-node src/scripts/seedDatabase.ts

# Start development server
npm run dev
```

Backend will be available at `http://localhost:5000`

### 3. Frontend Setup

```bash
# Open new terminal and navigate to client directory
cd client

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit environment variables
nano .env.local

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 4. Verify Setup

1. Visit `http://localhost:3000`
2. Register a new account
3. Verify email (check console logs for verification link)
4. Login and explore the dashboard

---

## 🔧 Detailed Configuration

### Backend Environment Variables

Create a `.env` file in the `server` directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/inventory_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Email Configuration (for development, use Mailtrap or similar)
EMAIL_HOST="smtp.mailtrap.io"
EMAIL_PORT="2525"
EMAIL_USER="your-mailtrap-username"
EMAIL_PASS="your-mailtrap-password"
EMAIL_FROM="noreply@yourcompany.com"

# Server Configuration
NODE_ENV="development"
PORT="5000"
CORS_ORIGIN="http://localhost:3000"

# File Upload Configuration (AWS S3 - optional)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-s3-bucket-name"

# Redis Configuration (optional)
REDIS_URL="redis://localhost:6379"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Frontend Environment Variables

Create a `.env.local` file in the `client` directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:5000"

# Authentication
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

---

## 🗄️ Database Setup

### PostgreSQL Installation

**On Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**On macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**On Windows:**
Download and install from [PostgreSQL Official Website](https://www.postgresql.org/download/windows/)

### Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE inventory_db;
CREATE USER inventory_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE inventory_db TO inventory_user;

# Exit PostgreSQL
\q
```

### Run Migrations

```bash
cd server
npm run prisma:migrate
```

### Seed Database (Optional)

```bash
# Create admin user
npx ts-node src/scripts/createAdminUser.ts

# Seed with sample data
npx ts-node src/scripts/seedDatabase.ts
```

---

## 🏭 Production Setup

### 1. Server Requirements

**Minimum Specifications:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 1Gbps connection

**Recommended Specifications:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 1Gbps+ connection

### 2. Environment Setup

**Install Node.js:**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Install PostgreSQL:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Install PM2 (Process Manager):**
```bash
sudo npm install -g pm2
```

### 3. Application Deployment

**Clone and Setup:**
```bash
# Clone repository
git clone https://github.com/your-org/inventory-manager.git
cd inventory-manager

# Backend setup
cd server
npm ci --only=production
npm run build

# Frontend setup
cd ../client
npm ci --only=production
npm run build
```

**Environment Configuration:**
```bash
# Backend production environment
cat > server/.env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/inventory_prod
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
PORT=5000
CORS_ORIGIN=https://yourdomain.com
# ... other production variables
EOF

# Frontend production environment
cat > client/.env.local << EOF
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
# ... other production variables
EOF
```

### 4. Database Setup

```bash
# Create production database
sudo -u postgres createdb inventory_prod
sudo -u postgres createuser --interactive inventory_prod_user

# Run migrations
cd server
npm run prisma:migrate
```

### 5. SSL Certificate Setup

**Using Let's Encrypt:**
```bash
# Install Certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Certificates will be stored in /etc/letsencrypt/live/yourdomain.com/
```

### 6. Nginx Configuration

**Install Nginx:**
```bash
sudo apt update
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Configure Nginx:**
```bash
sudo nano /etc/nginx/sites-available/inventory-app
```

```nginx
# Backend API (api.yourdomain.com)
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend Application (yourdomain.com)
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. PM2 Process Management

**Create PM2 ecosystem file:**
```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'inventory-backend',
      script: './server/dist/index.js',
      cwd: '/path/to/inventory-manager',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'inventory-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/inventory-manager/client',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
EOF
```

**Start applications:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Check status
sudo ufw status
```

### 2. Fail2Ban Installation

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure for SSH
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Start service
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Database Security

```bash
# Secure PostgreSQL installation
sudo -u postgres psql

-- Change default postgres password
ALTER USER postgres PASSWORD 'strong_password';

-- Create application user with limited privileges
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE inventory_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### 4. Environment Security

```bash
# Set proper file permissions
chmod 600 server/.env
chmod 600 client/.env.local

# Create non-root user for application
sudo adduser inventory
sudo usermod -aG sudo inventory

# Change ownership of application files
sudo chown -R inventory:inventory /path/to/inventory-manager
```

---

## 📊 Monitoring & Logging

### 1. PM2 Monitoring

```bash
# View logs
pm2 logs

# Monitor processes
pm2 monit

# View process status
pm2 status

# Restart applications
pm2 restart all
```

### 2. Log Management

**Configure log rotation:**
```bash
sudo nano /etc/logrotate.d/inventory-app
```

```
/path/to/inventory-manager/server/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 inventory inventory
}
```

### 3. Database Backup

**Create backup script:**
```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/var/backups/inventory"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="inventory_prod"

mkdir -p $BACKUP_DIR
pg_dump $DB_NAME > $BACKUP_DIR/inventory_backup_$DATE.sql
gzip $BACKUP_DIR/inventory_backup_$DATE.sql

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

**Schedule daily backups:**
```bash
# Add to crontab
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /path/to/backup-db.sh
```

---

## 🧪 Testing the Setup

### 1. Backend Health Check

```bash
# Check API health
curl http://localhost:5000/health

# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### 2. Frontend Testing

```bash
# Check if frontend is accessible
curl http://localhost:3000

# Run frontend tests
cd client
npm test
```

### 3. Load Testing

```bash
# Install Artillery for load testing
npm install -g artillery

# Run load tests
cd server
npm run test:load
```

---

## 🔄 Update and Maintenance

### 1. Application Updates

```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd server && npm update
cd client && npm update

# Rebuild applications
cd server && npm run build
cd client && npm run build

# Restart services
pm2 restart all
```

### 2. Database Migrations

```bash
# Run new migrations
cd server
npm run prisma:migrate
```

### 3. SSL Certificate Renewal

```bash
# Renew Let's Encrypt certificates
sudo certbot renew

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🆘 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port
sudo lsof -i :5000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

**Database Connection Issues:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**Permission Issues:**
```bash
# Fix file permissions
sudo chown -R inventory:inventory /path/to/app
chmod 644 .env files
```

**Memory Issues:**
```bash
# Check memory usage
free -m

# Check PM2 processes
pm2 monit
```

### Log Locations

- **Application Logs**: `/path/to/app/server/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **PostgreSQL Logs**: `/var/log/postgresql/`
- **PM2 Logs**: `~/.pm2/logs/`

---

## 📞 Support

For setup assistance:
- **Documentation**: Check this guide and API documentation
- **Issues**: Create GitHub issues for bugs
- **Community**: Join our Discord/Slack community
- **Professional Support**: Contact for enterprise support

---

*This setup guide is maintained and updated regularly. Last updated: December 2024* 