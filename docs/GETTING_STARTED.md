# Getting Started with ROF CRM

## 5-Minute Quick Start

### Prerequisites
- Node.js 18+ LTS
- pnpm (install via `npm install -g pnpm`)
- PostgreSQL 15+ (or Docker)
- Redis (or Docker)

### Installation

```bash
# 1. Navigate to project
cd "D:\Desktop\Grapes\ROF Project\rof-crm"

# 2. Install dependencies for all packages
pnpm install

# 3. Start PostgreSQL and Redis (using Docker)
docker-compose up -d

# 4. Configure environment variables
cp packages/api/.env.example packages/api/.env
# Edit if needed (defaults work with Docker services)

# 5. Run database migrations
cd packages/api
npm run migrate
cd ../..

# 6. Start the API server
cd packages/api && npm run dev
```

**Result**: Full application running at **http://localhost:3001**
- API endpoints available at http://localhost:3001/api/*
- Frontend served at http://localhost:3001
- No separate frontend dev server needed

---

## Using Docker (Recommended for Database + Redis)

```bash
# Start PostgreSQL + Redis in Docker
docker-compose up -d

# Verify services are healthy
docker-compose ps

# Check PostgreSQL connection
psql -h localhost -U postgres -d rof_crm -c "SELECT 1;"

# Check Redis connection
redis-cli ping
```

---

## Development Workflow

### Starting the Server

```bash
# Navigate to API package
cd packages/api

# Start the development server (TypeScript auto-compiles)
npm run dev

# Expected output:
# > tsx watch src/index.ts
# ROF CRM API running on http://localhost:3001
# Environment: development

# Visit http://localhost:3001 in your browser
```

### Building for Production

```bash
# Compile TypeScript to JavaScript
cd packages/api
npm run build

# Output: packages/api/dist/
# Deploy the dist/ folder to your production server
```

### Stopping the Server

```bash
# Press Ctrl+C in the terminal running npm run dev
# Or kill the process on port 3001:

# On Windows (PowerShell):
# Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force

# On macOS/Linux:
# kill -9 $(lsof -ti:3001)
```

---

## Frontend Access

### Local Development
Visit **http://localhost:3001** in your browser

### Features
- **No build step required** — Static HTML pages served directly
- **Real-time data** — All pages fetch from backend API
- **Mock authentication** — Use token `mock-jwt-token` (auto-applied)
- **41 pages** — Complete CRM UI with all modules

### Development with Live Changes
Since the frontend is static HTML served from Express:
1. Edit files in `packages/web/public/` (HTML, CSS, or JavaScript)
2. Refresh your browser
3. Changes appear immediately (no build step)

### If You Modify API Routes
```bash
# Backend TypeScript auto-compiles with tsx watch
# Just refresh the browser to see API changes
```

---

## Project Structure

```
rof-crm/
├── packages/
│   ├── api/                    👈 Backend (Node.js + Express)
│   │   ├── src/
│   │   │   ├── index.ts        Main server file (Express setup)
│   │   │   ├── db/             Database schema + migrations
│   │   │   ├── routes/         API endpoint handlers
│   │   │   └── middleware/     Auth, RBAC, audit logging
│   │   ├── dist/               Compiled JavaScript (production)
│   │   ├── package.json        Backend dependencies
│   │   └── .env.example        Environment template
│   ├── web/                    👈 Frontend (Static HTML)
│   │   └── public/             Served by Express backend
│   │       ├── index.html      SPA entry point
│   │       ├── js/
│   │       │   ├── app.js
│   │       │   ├── api-client.js
│   │       │   ├── router.js
│   │       │   ├── auth.js
│   │       │   ├── utils.js
│   │       │   ├── constants.js
│   │       │   └── pages/      41 page modules
│   │       └── css/            Styling
│   └── types/                  Shared TypeScript interfaces
├── docs/                       Documentation
├── docker-compose.yml         PostgreSQL + Redis
├── package.json              Root monorepo config
└── README.md                 Project overview
```

---

## Authentication & Authorization

### Development Mode
- **Mock token**: `mock-jwt-token`
- **Automatic**: Token is auto-included with all API requests in development
- **No login required**: Just visit http://localhost:3001
- **Full permissions**: Super Admin role with all features enabled

### In the Browser
1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Look for `rof-jwt` token (auto-stored)
4. All API requests include this token automatically

### Testing Authentication
```bash
# Test with mock token
curl -X GET http://localhost:3001/api/consumers \
  -H "Authorization: Bearer mock-jwt-token"

# Expected: JSON array of consumers
```

---

## Database: Running Migrations

Migrations run **automatically** when the server starts in development mode.

To manually verify migrations:
```bash
# Check if tables exist
psql -h localhost -U postgres -d rof_crm -c "\dt"

# You should see tables like:
# - users
# - consumers
# - units
# - projects
# - allocations
# - payments
# - demands
# - receipts
# - documents
# - communications
# - audit_logs
# ... and more
```

To manually run a specific migration:
```bash
cd packages/api
npm run migrate
```

---

## Working with the API

### Making API Calls from Frontend

All frontend pages use a shared API client configured in `packages/web/public/js/api-client.js`:

```javascript
// Example: Fetch consumers from dashboard.js
async function loadConsumers(filters = {}) {
  const response = await fetch('/api/consumers', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('rof-jwt')}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return data.data; // API wraps response in {success, data}
}
```

### API Response Format
```json
{
  "success": true,
  "data": [/* array of records */],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5
  }
}
```

### Common Endpoints
```bash
# Consumers
GET /api/consumers                          # List all
GET /api/consumers/{id}                     # Get one
POST /api/consumers                         # Create

# Units
GET /api/units                              # List all
GET /api/units/{id}                         # Get one

# Allocations
GET /api/allocations                        # List all
POST /api/allocations                       # Create

# Payments
GET /api/payments/receipts                  # List receipts
GET /api/payments/demands                   # List demands
POST /api/payments/receipts                 # Record payment

# Communications
GET /api/communications                     # List
POST /api/communications/send               # Send message

# Reports
GET /api/reports/dashboard                  # Dashboard KPIs
```

---

## Debugging

### API Debugging

```bash
# Check if API is running
curl http://localhost:3001/health

# Expected: {"status":"ok","timestamp":"2026-05-02T..."}

# View API logs (already visible in terminal running npm run dev)
# Press Ctrl+C to stop

# Test API endpoint with mock token
curl -X GET http://localhost:3001/api/consumers \
  -H "Authorization: Bearer mock-jwt-token"
```

### Frontend Debugging

```bash
# Open browser DevTools (F12)
# Console tab: View any JavaScript errors
# Network tab: Inspect API requests/responses
# Application tab: View localStorage (rof-jwt token, rof-theme)
# Elements tab: Inspect HTML/CSS
```

### Database Debugging

```bash
# Connect directly to PostgreSQL
psql -h localhost -U postgres -d rof_crm

# List all tables
\dt

# View consumers table
SELECT id, name, mobile, email FROM consumers LIMIT 5;

# Exit
\q
```

### Server Not Starting?

```bash
# Check if port 3001 is already in use
# On Windows PowerShell:
Get-NetTCPConnection -LocalPort 3001

# On macOS/Linux:
lsof -i :3001

# Kill the process:
# Windows: taskkill /PID <pid> /F
# macOS/Linux: kill -9 <pid>

# Then restart
cd packages/api && npm run dev
```

---

## Test Data

The project includes test data for development:

### Loaded Data
- **5 Consumers**: Amit Rohilla, Dharam Veer, Prem Kumar, Rashmi Gupta, Rohit Kumar Singh
- **ROF ALANTE_TEST Project**: Sample project with towers A, B, C
- **Units**: 25+ units across towers with various statuses
- **Allocations**: All consumers allocated to specific units
- **Payments**: Multiple payment schedules and received receipts
- **Demands**: Generated demand letters with due dates

### View Test Data
1. Open http://localhost:3001
2. Navigate to Consumers page
3. You'll see all 5 test consumers with their details
4. Click any consumer to view allocation, payment history, documents

### Reset to Clean Data
```bash
# Stop the server (Ctrl+C)
cd packages/api

# Drop and recreate database
npm run migrate  # This will reset and re-seed

# Restart
npm run dev
```

---

## Code Quality

### Linting & Formatting
```bash
# Lint backend code
cd packages/api && npm run lint

# Format code (auto-fix)
npm run format

# Type check
npm run type-check
```

### Running Tests (if applicable)
```bash
# From project root
pnpm test
```

---

## Common Tasks

### Add a New Consumer
```bash
curl -X POST http://localhost:3001/api/consumers \
  -H "Authorization: Bearer mock-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "mobile": "9876543210",
    "email": "john@example.com",
    "income_category": "EWS",
    "project_id": "a0000000-0000-0000-0000-000000000002"
  }'
```

### Record a Payment
```bash
curl -X POST http://localhost:3001/api/payments/receipts \
  -H "Authorization: Bearer mock-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "d0000000-0000-0000-0000-000000000001",
    "amount_inr": 100000,
    "payment_method": "bank_transfer",
    "transaction_ref": "UTR123456"
  }'
```

### Allocate a Unit
```bash
curl -X POST http://localhost:3001/api/allocations \
  -H "Authorization: Bearer mock-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": "d0000000-0000-0000-0000-000000000001",
    "unit_id": "c0000000-0000-0000-0000-000000000001"
  }'
```

---

## Troubleshooting

### "Cannot GET /api/consumers"
- Make sure API is running: `npm run dev` in `packages/api`
- Check Authorization header includes mock-jwt-token
- Verify http://localhost:3001/health returns OK

### "Database connection refused"
```bash
# Ensure Docker containers are running
docker-compose ps

# Start if not running
docker-compose up -d

# Verify PostgreSQL is accessible
psql -h localhost -U postgres -d rof_crm -c "SELECT 1;"
```

### "Port 3001 already in use"
```bash
# Find process using port 3001
# Windows: Get-NetTCPConnection -LocalPort 3001
# macOS/Linux: lsof -i :3001

# Kill it and restart
npm run dev
```

### "Frontend not updating after code changes"
- The frontend is static HTML; just refresh your browser
- API changes require restarting npm run dev (it auto-compiles)

### "Missing environment variables"
```bash
# Copy the example .env
cp packages/api/.env.example packages/api/.env

# Edit with your database credentials if different from Docker defaults
# Then restart npm run dev
```

---

## Resources

- **Main README**: See `README.md`
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **Testing Results**: See `PHASE1_FINAL_VALIDATION.md`
- **API Code**: Check `packages/api/src/routes/`
- **Database Schema**: Check `packages/api/src/db/`
- **Frontend Code**: Check `packages/web/public/`

---

## Next Steps

1. ✅ **Start development**: http://localhost:3001
2. ✅ **Explore test data**: Consumers page shows 5 test records
3. ✅ **Try an API call**: curl to any /api/consumers endpoint
4. ✅ **Browse all 41 pages**: Navigation menu in top-left
5. ✅ **Read the docs**: Check IMPLEMENTATION_SUMMARY.md for full feature list

---

**Happy coding!** 🚀

For issues, questions, or contributions, contact the ROF CRM team.
