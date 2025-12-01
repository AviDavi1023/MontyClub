# Clear Data (Factory Reset) Feature

## Overview
Secure data clearing feature in the Admin Panel that allows administrators to selectively delete various types of data. This is useful for testing, demonstrations, or resetting the system to a clean state.

## Security
- **Dual Authentication Required:**
  - Admin password (verified via bcrypt)
  - Admin API key (from environment variable `ADMIN_API_KEY`)
- Both credentials must be valid for any data clearing operation to proceed

## Location
**Admin Panel** → Scroll to bottom → **System Maintenance** section

## UI Design
- Subtle gray styling (not attention-grabbing)
- Located at the bottom of the admin panel
- Requires opening a modal to access the actual clearing interface
- Designed to prevent accidental clicks

## Data Types Available for Clearing

### 1. Client LocalStorage ✅ (Default selected)
- Clears all browser localStorage data
- Includes pending changes, cached settings, etc.
- Executed client-side after server confirmation

### 2. Update Requests
- Deletes all club update submissions from `data/updates.json`
- Clears `updatesCache` in memory
- Cannot be undone

### 3. Announcements
- Removes all club announcements from `data/announcements.json`
- Clears `announcementsCache` in memory
- All clubs will have no announcements after clearing

### 4. Registration Collections
- Resets to a single default collection: "Club Registration 2025"
- Slug: `club-registration-2025`
- Deletes all custom collections
- Clears `registrationActionsCache` in memory

### 5. All Registrations ⚠️ (Destructive)
- **DANGER:** Deletes ALL club registration submissions
- Removes all files in `storage/registrations/` directory
- Highlighted in red to indicate severity
- Cannot be undone

### 6. Analytics Events
- Clears all analytics tracking data
- Removes all files in `storage/analytics/` directory
- Useful for resetting metrics during testing

## API Endpoint

**POST** `/api/admin/clear-data`

### Request Body
```json
{
  "password": "admin_password",
  "adminApiKey": "your_admin_api_key",
  "clearOptions": {
    "localStorage": true,
    "updateRequests": false,
    "announcements": false,
    "registrationCollections": false,
    "registrations": false,
    "analytics": false
  }
}
```

### Response (Success)
```json
{
  "success": true,
  "cleared": {
    "updates": 12,
    "announcements": 5,
    "registrationCollections": 3,
    "registrations": 45,
    "analytics": 156
  }
}
```

### Response (Error)
```json
{
  "error": "Invalid password or API key"
}
```

## Usage Instructions

1. **Navigate to Admin Panel**
   - Log in with admin credentials
   - Scroll to the bottom of the page to find "System Maintenance" section

2. **Open Modal**
   - Click the "Clear Data" button (gray button at bottom)

3. **Authenticate**
   - Enter your admin password
   - Enter the admin API key (stored in `.env.local` as `ADMIN_API_KEY`)

4. **Select Data Types**
   - Check the boxes for data you want to clear
   - **LocalStorage** is selected by default
   - **All Registrations** is highlighted in red as a warning

5. **Confirm & Execute**
   - Click "Clear Selected Data"
   - Wait for confirmation toast
   - Modal closes automatically on success

6. **Auto-Refresh**
   - All data is automatically refreshed after clearing
   - 500ms delay ensures cache invalidation completes

## Safety Features

### Visual Warnings
- Modal has prominent red warnings
- ⚠️ Warning emoji in modal header
- Bold red text for destructive options (All Registrations)
- Confirmation message before clearing
- Button positioned at bottom to reduce visibility

### Input Validation
- Both password and API key are required
- At least one data type must be selected
- Disabled state during clearing operation

### Error Handling
- Individual clear operations can fail independently
- Partial failures are reported with details
- Client localStorage clearing is isolated (won't fail server operations)

### Cache Invalidation
- All relevant caches are cleared after data deletion
- Ensures UI reflects true database state
- Prevents stale data from being displayed

## Environment Setup

Ensure `.env.local` contains:
```env
ADMIN_API_KEY=your_secure_random_key_here
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Implementation Details

### Frontend (components/AdminPanel.tsx)
- State management for modal, password, API key, and selections
- `handleClearData()` function handles API call and localStorage clearing
- Toast notifications for success/error feedback
- Auto-refresh after successful clearing

### Backend (app/api/admin/clear-data/route.ts)
- Validates admin password via bcrypt
- Validates API key from environment
- Granular clearing with independent error handling
- Returns detailed counts of cleared items
- Cache invalidation after clearing

## Best Practices

1. **Backup Before Clearing**
   - Always backup important data before using this feature
   - Consider exporting registrations if needed

2. **Use Selectively**
   - Only select data types you actually want to clear
   - Be especially careful with "All Registrations"

3. **Test Environment**
   - Use this primarily for testing/demo environments
   - Production use should be rare and carefully planned

4. **Credential Security**
   - Never share admin password or API key
   - Rotate credentials if compromised
   - Use strong, unique values

## Troubleshooting

### "Invalid password or API key"
- Verify admin password is correct
- Check `.env.local` has `ADMIN_API_KEY` set
- Restart dev server if `.env.local` was recently modified

### "Failed to clear data"
- Check file system permissions
- Verify storage directories exist
- Check browser console for detailed errors

### LocalStorage not clearing
- Browser security settings may block
- Try manually clearing in DevTools
- Close and reopen tab

### Data still appears after clearing
- Wait for auto-refresh (500ms delay)
- Manually refresh the page
- Check if cache invalidation completed

## Related Files
- `/app/api/admin/clear-data/route.ts` - Backend endpoint
- `/components/AdminPanel.tsx` - Frontend UI
- `/lib/api-cache.ts` - Cache infrastructure
- `/lib/supabase.ts` - Storage utilities
