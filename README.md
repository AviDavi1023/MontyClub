# Carlmont Club Catalog

A simple, fast, mobile-friendly web app for discovering Carlmont clubs.

## Features

- 🔍 Search and filter clubs by name, category, meeting day, location, grade level, and status
- 📱 Mobile-first responsive design with dark mode support
- 📋 Detailed club information pages
- 🔗 Similar clubs recommendations
- 📝 Submit update form for club information changes
- 🎨 Modern, minimalist design focused on clarity and usability

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS
- **Language**: TypeScript
- **Data Source**: Excel file (clubData.xlsx) - Secure ExcelJS library
- **Icons**: Lucide React

## Getting Started

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your Excel file**:
   - Create an Excel file named `clubData.xlsx` in the root directory
   - Follow the format specified in `EXCEL_FORMAT.md`
   - The app will use mock data if the file is not found

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Excel File Data Format

Your Excel file should have these columns (in order):
- **ID**: Unique identifier for each club
- **Name**: Club name
- **Category**: Club category (e.g., Academic, Arts, Sports, etc.)
- **Description**: Brief description of the club
- **Advisor**: Teacher/staff advisor name
- **Student Leader**: Student leader name(s)
- **Meeting Time**: When the club meets
- **Location**: Where the club meets
- **Contact**: Email or contact information
- **Social Media**: Social media handle (e.g., @clubname)
- **Active**: "Active" or "Inactive" (case insensitive)
- **Grade Level**: Grade levels (e.g., "9-12", "10-12")
- **Keywords**: Comma-separated keywords for search

See `EXCEL_FORMAT.md` for detailed formatting instructions.

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── clubs/[id]/        # Dynamic club detail pages
│   ├── submit-update/     # Submit update form page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ClubCard.tsx       # Club card component
│   ├── ClubDetail.tsx     # Club detail page component
│   ├── ClubsList.tsx      # Main clubs listing
│   ├── FilterPanel.tsx    # Search and filter controls
│   ├── Header.tsx         # Site header
│   ├── LoadingSpinner.tsx # Loading indicator
│   ├── SimilarClubs.tsx   # Similar clubs section
│   ├── SubmitUpdateForm.tsx # Update submission form
│   ├── ThemeProvider.tsx  # Dark mode provider
│   └── ThemeToggle.tsx    # Dark mode toggle
├── lib/                   # Utility functions
│   └── clubs.ts          # Excel file integration
├── types/                 # TypeScript type definitions
│   └── club.ts           # Club data types
└── ...config files
```

## Features in Detail

### Search and Filtering
- **Text Search**: Search by club name, description, or keywords
- **Category Filter**: Filter by club category
- **Meeting Day**: Filter by meeting day
- **Status**: Filter by active/inactive status
- **Grade Level**: Filter by grade level

### Club Detail Pages
- Complete club information
- Contact details and social media links
- Similar clubs recommendations
- Mobile-optimized layout

### Dark Mode
- System preference detection
- Manual toggle
- Persistent across sessions

### Submit Updates
- Form for requesting club information changes
- Multiple update types supported
- Email contact for follow-up

## Deployment

The app is ready for deployment on platforms like:
- Vercel (recommended for Next.js)
- Netlify
- Any static hosting service

Make sure to include your `clubData.xlsx` file in the deployment.

## Future Enhancements

- Admin panel for direct editing
- Real form submission integration
- Club photo uploads
- Advanced search with filters
- Club event calendar integration
- Student interest tracking

## Contributing

This is a school project. For improvements or bug fixes, please contact the development team.

## License

This project is for educational use at [Your School Name].
