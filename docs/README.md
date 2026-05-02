# ROF CRM — Documentation

This folder contains all project documentation for the ROF CRM Platform.

## Files

| File | Description |
|------|-------------|
| **GETTING_STARTED.md** | Setup guide with prerequisites, installation steps, how to run the project locally, and Docker setup |
| **IMPLEMENTATION_SUMMARY.md** | Phase 1 completion summary documenting what was built, architecture decisions, and module details |
| **PHASE1_FINAL_VALIDATION.md** | Phase 1 testing results, feature checklist, quality assurance notes, and validation outcomes |
| **WEEK2_WEEK3_IMPLEMENTATION.md** | Week-by-week implementation timeline and deliverables from the development cycle |

## Quick Reference

### Project Structure
- **Backend API**: `packages/api/` — Node.js + Express + PostgreSQL
- **Frontend (Static HTML)**: `packages/web/public/` — 41 pages, vanilla JavaScript
- **Design System**: `packages/design-system/` — Reusable components and design tokens
- **Shared Types**: `packages/types/` — TypeScript interfaces

### Key Locations
- **Database Migrations**: `packages/api/src/db/migrations/`
- **API Routes**: `packages/api/src/routes/`
- **Environment Config**: `packages/api/.env`
- **HTML Pages**: `packages/web/public/js/pages/`

### Running the Project

```bash
# Install dependencies
pnpm install

# Start all services (backend on 3001, storybook on 6006)
pnpm dev

# Or run backend only
cd packages/api && npm run dev

# Run migrations
npm run migrate
```

### Frontend
The static HTML frontend is served from `packages/api/src/index.ts` at port 3001.
- Access the app at: `http://localhost:3001`
- API base URL: `/api` (relative path, same server)
- No separate frontend dev server required

### Database
PostgreSQL must be running. Either:
- Use Docker: `docker-compose up -d`
- Or provide connection string in `packages/api/.env`

---

For questions or updates, refer to the [main README](../README.md) in the project root.
