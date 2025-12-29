# MontyClub - Carlmont High School Club Management System

A comprehensive web application for managing and discovering clubs at Carlmont High School. Features a public-facing club catalog, club registration system, and full administrative dashboard.

## Overview

MontyClub serves three primary user groups:

- **Students**: Browse and discover clubs through an intuitive, searchable catalog
- **Club Leaders**: Submit charter requests and renewal applications for their clubs
- **Administrators**: Manage registration collections, approve/deny applications, handle user permissions, and view analytics

## Key Features

### Public Club Catalog
- 🔍 Advanced search and filtering (by name, category, meeting day, frequency)
- 📱 Mobile-first responsive design with dark mode support
- 📋 Detailed club pages with contact information and similar club recommendations
- ⚡ Optimized performance with pagination and intelligent caching

### Club Registration System
- 📝 Student-led charter request submissions
- 🔄 Club renewal process for existing clubs
- 📊 Admin approval workflow with status tracking
- 🏷️ Collection-based organization (e.g., "Fall 2024 Registrations", "Spring 2025 Renewals")

### Admin Dashboard
- 👥 User management with role-based permissions
- ✅ Registration approval/denial with reason tracking
- 📢 Announcements and updates management
- 📊 Analytics and reporting
- 🗃️ Multiple registration collection management
- 💾 Excel file import for bulk club data

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Data Storage**: Supabase Storage (primary), Vercel KV (cache), File System (fallback)
- **Authentication**: Custom token-based admin authentication
- **Icons**: Lucide React
- **File Processing**: ExcelJS (for legacy Excel imports)

## Data Architecture

MontyClub uses a multi-tier storage strategy:

1. **Supabase Storage** (Primary): JSON files stored in `club-data` bucket
   - `settings/registration-collections` - Collection definitions
   - `registrations/{collectionId}/{registrationId}.json` - Individual club submissions
   - `settings/announcements.json` - System-wide announcements
   - `settings/updates.json` - Update requests

2. **Vercel KV** (Cache Layer): Redis-based caching for performance

3. **File System** (Local Fallback): Used in development

4. **Excel Import** (Legacy): Optional bulk import via `clubData.xlsx`

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for production storage)
- Vercel account (optional, for KV cache and deployment)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd MontyClub
   npm install
   ```

2. **Configure environment variables**:
   
   Create a `.env.local` file in the root directory:
   ```env
   # Required: Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Required: Admin Authentication
   ADMIN_API_KEY=your_secure_admin_password
   
   # Optional: Vercel KV (for caching)
   KV_REST_API_URL=your_kv_rest_api_url
   KV_REST_API_TOKEN=your_kv_rest_api_token
   
   # Optional: Analytics
   NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
   ```

3. **Set up Supabase Storage**:
   - Create a bucket named `club-data` in your Supabase project
   - Set appropriate permissions for reading and writing
   - Initialize with empty collections file: `settings/registration-collections`

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   - Public catalog: [http://localhost:3000](http://localhost:3000)
   - Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin)
   - Registration form: [http://localhost:3000/register-club?collection={id}](http://localhost:3000/register-club?collection={id})

## Project Structure

```
MontyClub/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Public club catalog homepage
│   ├── layout.tsx               # Root layout with theme provider
│   ├── admin/                   # Admin dashboard
│   ├── clubs/[slug]/           # Dynamic club detail pages
│   ├── register-club/          # Club charter registration form
│   ├── renew-club/             # Club renewal form
│   ├── submit-update/          # Public update request form
│   └── api/                    # API Routes
│       ├── clubs/              # Club data endpoints
│       ├── registration-*/     # Registration CRUD operations
│       ├── auth/               # Authentication endpoints
│       ├── analytics/          # Analytics data
│       └── upload-excel/       # Excel import handler
├── components/                  # React components
│   ├── AdminPanel.tsx          # Main admin dashboard (4000+ lines)
│   ├── ClubsList.tsx           # Public club listing with filters
│   ├── ClubRegistrationForm.tsx # Charter request form
│   ├── RegistrationsList.tsx   # Admin registration management
│   ├── UserManagement.tsx      # Admin user permissions
│   └── ui/                     # Reusable UI components
├── lib/                        # Utility functions and logic
│   ├── clubs.ts               # Club data fetching and transformation
│   ├── clubs-client.ts        # Client-side club API calls
│   ├── supabase.ts            # Supabase client and storage utilities
│   ├── auth.ts                # Authentication and password management
│   ├── api-cache.ts           # In-memory caching with locking
│   ├── broadcast.ts           # Cross-tab synchronization
│   ├── storage-utils.ts       # Safe localStorage operations
│   ├── idempotency.ts         # Request deduplication
│   ├── registration-lock.ts   # Concurrent update protection
│   └── ...                    # Additional utilities
├── types/
│   └── club.ts                # TypeScript type definitions
├── data/
│   ├── announcements.json     # Sample announcements
│   └── updates.json           # Sample updates
├── EXCEL_FORMAT.md            # Excel import format documentation
└── README.md                  # This file
```

## Core Workflows

### For Students (Public)
1. Visit homepage to browse clubs
2. Use filters to narrow down options (category, meeting day, etc.)
3. Click on a club to view full details
4. Submit update requests if club information is outdated

### For Club Leaders (Registration)
1. Admin shares registration link with collection ID
2. Student leader fills out charter request form
3. Form validates required fields (advisor signature, club details)
4. Submission stored as JSON in Supabase Storage
5. Admin receives notification to review

### For Administrators
1. Log in to admin panel with secure API key
2. Manage registration collections (create new periods, toggle acceptance)
3. Review pending registrations and approve/deny with reasoning
4. Approved clubs automatically appear in public catalog
5. Manage system announcements and user permissions
6. View analytics dashboard for insights

## Security Features

- **Authentication**: Token-based admin authentication (not persisted in localStorage)
- **API Protection**: All admin routes validate `ADMIN_API_KEY` environment variable
- **Request Deduplication**: Prevents duplicate submissions via idempotency keys
- **Concurrent Update Protection**: Distributed locking prevents data corruption
- **Safe File Uploads**: Size limits and memory-safe processing for Excel imports
- **Cross-tab Sync**: BroadcastChannel API with message queueing for consistency

## Performance Optimizations

- **Multi-layer Caching**: In-memory + Redis + eventual consistency model
- **Request Collapsing**: Deduplicates simultaneous identical API calls
- **Pagination**: Default 12 clubs per page for faster load times
- **Skeleton Loading**: Instant visual feedback while data loads
- **Optimistic UI**: Immediate feedback with background persistence

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**:
   - Import repository in Vercel dashboard
   - Configure environment variables (same as `.env.local`)
   - Deploy automatically on push

3. **Post-deployment**:
   - Verify Supabase connection
   - Test admin authentication
   - Create first registration collection

### Other Platforms

Compatible with any platform supporting Next.js 15:
- Netlify
- AWS Amplify
- Railway
- Self-hosted with Node.js

**Important**: Ensure all environment variables are properly set in production.

## Excel Import (Legacy Feature)

MontyClub supports bulk club imports via Excel files for backwards compatibility:

1. Prepare `clubData.xlsx` following the format in [EXCEL_FORMAT.md](./EXCEL_FORMAT.md)
2. Upload via Admin Panel → Excel Upload
3. Clubs are parsed and stored in Supabase Storage
4. This feature is optional - normal workflow uses registration forms

## Development Notes

- **TypeScript**: Full type safety with strict mode enabled
- **ESLint**: Code quality checks via `npm run lint`
- **Hot Reload**: Automatic refresh during development
- **API Routes**: RESTful design with proper error handling
- **Dark Mode**: Respects system preference with manual override

## Troubleshooting

### "No clubs found"
- Check Supabase connection and bucket permissions
- Verify at least one collection has `display: true`
- Ensure approved registrations exist in that collection

### Admin panel won't load
- Verify `ADMIN_API_KEY` is set in environment variables
- Check browser console for authentication errors
- Ensure Supabase Storage is accessible

### Excel import fails
- Verify file format matches [EXCEL_FORMAT.md](./EXCEL_FORMAT.md)
- Check file size (limit: 5MB)
- Review server logs for parsing errors

## Contributing

This is a school project for Carlmont High School. For bug reports or feature requests, please contact the development team.

## License

Educational use only - Carlmont High School
