# Getting Started with ROF CRM

## 5-Minute Quick Start

### Prerequisites
- Node.js 20+ LTS
- pnpm (install via `npm install -g pnpm`)
- PostgreSQL 15+
- Redis (optional, for job queues)

### Installation

```bash
# 1. Navigate to project
cd "D:\Desktop\Grapes\ROF Project\rof-crm"

# 2. Install dependencies
pnpm install

# 3. Set up environment (API)
cp packages/api/.env.example packages/api/.env

# 4. Edit .env if needed (DB credentials, JWT secret, etc.)
# nano packages/api/.env

# 5. Build shared packages
pnpm -r build

# 6. Start all services
pnpm dev
```

**Result**: 
- API running on http://localhost:3000
- Web app on http://localhost:5173
- Storybook on http://localhost:6006

---

## Using Docker (Recommended for Database + Redis)

```bash
# Start PostgreSQL + Redis in Docker
docker-compose up -d

# Verify services are healthy
docker-compose ps

# API will automatically connect (assuming .env is correct)
```

---

## Development Workflow

### Monorepo Commands

```bash
# Start all services in parallel
pnpm dev

# Start only API
pnpm -F @rof-crm/api dev

# Start only Web
pnpm -F @rof-crm/web dev

# Start only Storybook (design system)
pnpm storybook:dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Format all packages
pnpm format

# Type-check all packages
pnpm type-check
```

### Adding a New Component

```bash
# 1. Create component file
# packages/design-system/src/components/MyComponent.tsx

# 2. Create Storybook file
# packages/design-system/src/components/MyComponent.stories.tsx

# 3. Export in index
# packages/design-system/src/components/index.ts

# 4. Run Storybook to see it
pnpm storybook:dev
```

### Creating a New API Endpoint

```bash
# 1. Define types in types package
# packages/types/src/myfeature.ts

# 2. Create route handler
# packages/api/src/routes/myfeature.ts

# 3. Import and register in index.ts
# app.use('/api/myfeature', myfeatureRoutes);

# 4. Test via curl or Postman
curl http://localhost:3000/api/myfeature
```

### Building a New Page

```bash
# 1. Create page component
# packages/web/src/pages/myfeature/MyFeaturePage.tsx

# 2. Add route in App.tsx
# <Route path="/myfeature" element={<MyFeaturePage />} />

# 3. Add navigation in Layout.tsx sidebar

# 4. Test at http://localhost:5173/myfeature
```

---

## Project Structure

```
rof-crm/
├── packages/
│   ├── design-system/        👈 React components + design tokens
│   │   ├── src/components/   Components (Button, Card, etc.)
│   │   ├── src/theme/        Design tokens (colors, spacing, shadows, etc.)
│   │   └── .storybook/       Component documentation
│   ├── types/                👈 Shared TypeScript interfaces
│   │   └── src/              Consumer, Unit, Payment, User, etc.
│   ├── api/                  👈 Backend (Express + PostgreSQL)
│   │   ├── src/db/           Database schema
│   │   ├── src/routes/       API endpoints (to be created)
│   │   └── src/services/     Business logic (to be created)
│   └── web/                  👈 Frontend (React + Vite)
│       ├── src/pages/        Page components
│       ├── src/components/   Reusable components
│       ├── src/hooks/        Custom hooks (to be created)
│       ├── src/store/        Zustand state
│       └── src/api/          API client + React Query
├── README.md                 Project overview
├── IMPLEMENTATION_SUMMARY.md What's been built
└── GETTING_STARTED.md        This file
```

---

## Design System: Using Components

### Example: Using the Button Component

```tsx
import { Button } from '@rof-crm/design-system';

export function MyComponent() {
  return (
    <Button variant="primary" size="medium">
      Click Me
    </Button>
  );
}
```

### Example: Using Design Tokens

```tsx
import { colors, spacing } from '@rof-crm/design-system';

export function MyComponent() {
  return (
    <div style={{
      background: colors.neutral[50],
      padding: spacing.md,
      color: colors.neutral[800],
    }}>
      Content here
    </div>
  );
}
```

### Example: Using Tailwind Utilities

```tsx
export function MyComponent() {
  return (
    <div className="bg-neutral-50 p-md text-neutral-800">
      Content here
    </div>
  );
}
```

---

## API Client: Making Requests

### Using React Query Hook (Recommended)

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export function ConsumerList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['consumers'],
    queryFn: async () => {
      const res = await apiClient.get('/consumers');
      return res.data;
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render consumers */}</div>;
}
```

### Using Axios Directly (If Needed)

```tsx
import { apiClient } from '../api/client';

const response = await apiClient.post('/consumers', {
  name: 'John Doe',
  mobile: '9876543210',
  email: 'john@example.com',
});
```

---

## Authentication

### Login Flow

```tsx
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

async function handleLogin(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  const { user, token, permissions } = response.data;
  
  useAuthStore.getState().setAuth(user, token, permissions);
  navigate('/'); // Redirect to dashboard
}
```

### Protecting Routes

```tsx
import { ProtectedRoute } from '../components/ProtectedRoute';

<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
    <Route path="/" element={<DashboardPage />} />
  </Route>
</Routes>
```

---

## State Management (Zustand)

### Auth Store

```tsx
import { useAuthStore } from '../store/authStore';

export function Profile() {
  const { user, logout } = useAuthStore();

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

### UI Store

```tsx
import { useUiStore } from '../store/uiStore';

export function Navbar() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  return (
    <button onClick={() => setSidebarOpen(!sidebarOpen)}>
      {sidebarOpen ? '→' : '←'}
    </button>
  );
}
```

---

## Database: Running Migrations

```bash
# Migrations run automatically on Docker startup
# Or manually:

pnpm -F @rof-crm/api db:migrate

# Verify tables exist:
psql -h localhost -U postgres -d rof_crm -c "\dt"
```

---

## Debugging

### API Debugging

```bash
# Check if API is running
curl http://localhost:3000/health

# View API logs
pnpm -F @rof-crm/api dev  # Shows all logs

# Check database connection
psql -h localhost -U postgres -d rof_crm
```

### Frontend Debugging

```bash
# React DevTools (install browser extension)
# Redux DevTools for Zustand (browser extension)

# Console errors in browser DevTools (F12)
# Network tab to inspect API calls
```

### Storybook Debugging

```bash
pnpm storybook:dev
# Visit http://localhost:6006
# Interactive component testing
```

---

## Code Quality

### Pre-commit Checks

```bash
# Lint (must pass before commit)
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check

# All checks together
pnpm lint && pnpm type-check
```

### Code Review Checklist

Before submitting PR, ensure:
- ✅ No hardcoded colors (use `colors.*` tokens)
- ✅ No arbitrary spacing (use `spacing.*` tokens)
- ✅ No arbitrary shadows (use `elevation-*` classes)
- ✅ All components have `.stories.tsx` files
- ✅ No 'any' types (TypeScript strict mode)
- ✅ Forms use `zod + react-hook-form`
- ✅ Data fetching uses `React Query`
- ✅ State uses `Zustand` (not Redux)
- ✅ WCAG 2.1 AA compliance (color contrast, keyboard nav)
- ✅ All tests passing (if applicable)

---

## Common Tasks

### Add a New Consumer

```tsx
// In API
POST /api/consumers
{
  "name": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",
  "aadhaar": "1234567890123456",
  "pan": "ABCDE1234F",
  "incomeCategory": "EWS",
  "projectId": "uuid-here"
}

// In Web Component
const { mutate: createConsumer } = useMutation({
  mutationFn: (data) => apiClient.post('/consumers', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['consumers'] });
  },
});
```

### Record a Payment

```tsx
POST /api/payments/receipts
{
  "paymentPlanId": "uuid",
  "installmentIndex": 0,
  "amountReceivedInr": 500000,  // in paise
  "paymentMethod": "bank_transfer",
  "transactionRef": "UTR123456",
  "receivedDate": "2026-04-26"
}
```

### Generate an Allotment Letter

```tsx
POST /api/allocations
{
  "consumerId": "uuid",
  "unitId": "uuid",
  "projectId": "uuid"
}

// Returns:
{
  "allocationId": "uuid",
  "allotmentLetterId": "uuid",
  "status": "allotted"
}
```

---

## Troubleshooting

### "Cannot find module @rof-crm/design-system"

```bash
# Make sure you've built the design-system
pnpm -F @rof-crm/design-system build

# And types package
pnpm -F @rof-crm/types build
```

### "Database connection refused"

```bash
# Check PostgreSQL is running
docker-compose ps

# Or start it
docker-compose up -d postgres

# Verify credentials in .env match
```

### "Port 5173 already in use"

```bash
# Use different port
pnpm -F @rof-crm/web dev -- --port 5174
```

### "TypeScript errors"

```bash
# Full type check
pnpm type-check

# Fix auto-fixable errors
pnpm format
```

---

## Resources

- **Design System**: Open `http://localhost:6006` (Storybook)
- **API Docs**: Check `packages/api/src/routes/` files
- **Types Reference**: Check `packages/types/src/`
- **Database Schema**: See `packages/api/src/db/schema.sql`
- **Main README**: See `README.md`
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`

---

## Next Steps

1. **Start development**: `pnpm dev`
2. **Explore Storybook**: http://localhost:6006
3. **Read the code**: Start with `packages/design-system/src/theme/`
4. **Build a component**: Create one in design-system package
5. **Create an API endpoint**: Add a route in api package
6. **Build a page**: Create one in web package

---

**Happy coding!** 🚀

For issues, questions, or contributions, see `CONTRIBUTING.md` (to be created).
