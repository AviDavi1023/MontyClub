# Excel File Format (Import)

This reflects the current Excel import behavior used by the admin "Import Excel" flow.

## Required Format

- **File type:** `.xlsx` only
- **First row:** Header row (any header names are acceptable)
- **Column order matters** (the importer reads by position, not header text)

## Column Mapping (by position)

| Column | Header (suggested) | Used For | Required | Notes |
|--------|-------------------|----------|----------|-------|
| A | ID | Not used for import | No | Can be blank or any value |
| B | Name | `clubName` | Yes | Empty rows are skipped |
| C | Category | `category` | No | Optional |
| D | Description | `statementOfPurpose` | No | Optional |
| E | Advisor | `advisorName` | No | Optional |
| F | Student Leader | `studentContactName` | No | Optional |
| G | Meeting Time | `meetingDay` | No | Optional |
| H | Location | `location` | No | Optional |
| I | Contact | `studentContactEmail` | No | Optional |
| J | Social Media | `socialMedia` | No | Optional |
| K | Active | Not used for import | No | Ignored by importer |
| L | Notes | `notes` | No | Optional |
| M | Keywords | Not used for import | No | Ignored by importer |
| N | Meeting Frequency | `meetingFrequency` | No | Optional |

## Optional Columns

The importer ignores extra columns beyond column N. You can leave unused columns blank.

## Sample Header Row

| ID | Name | Category | Description | Advisor | Student Leader | Meeting Time | Location | Contact | Social Media | Active | Notes | Keywords | Meeting Frequency |

## Sample Data

| ID | Name | Category | Description | Advisor | Student Leader | Meeting Time | Location | Contact | Social Media | Active | Notes | Keywords | Meeting Frequency |
|----|------|----------|-------------|---------|----------------|--------------|----------|--------|--------------|--------|-------|----------|-------------------|
| 1 | Debate Club | Academic | Develop public speaking skills | Ms. Johnson | Alex Chen | Tuesdays 3:30 PM | Room 201 | debate@school.edu | @schooldebate | Active | Tournament season starts Oct. | speaking,competition,academic | Weekly |
| 2 | Robotics Team | STEM | Build and program robots | Mr. Smith | Sarah Kim | Wednesdays 4:00 PM | Tech Lab | robotics@school.edu | @schoolrobotics | Active | Tryouts in September | engineering,programming,competition | 1st and 3rd weeks of the month |

## Import Notes

- Imported rows are inserted as **approved registrations** in the selected collection.
- The importer does **not** validate header names; only column positions matter.
- Blank rows (missing a club name in column B) are skipped.
