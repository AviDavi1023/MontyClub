# Excel Import Format

Use this guide when preparing `.xlsx` files for admin bulk import.

## Rules

- File type must be `.xlsx`.
- Row 1 should be a header row.
- Column order matters.
- Header text itself is not enforced.

## Column Map

| Column | Suggested Header | Field Used | Required |
|---|---|---|---|
| A | ID | Not used | No |
| B | Name | `clubName` | Yes |
| C | Category | `category` | No |
| D | Description | `statementOfPurpose` | No |
| E | Advisor | `advisorName` | No |
| F | Student Leader | `studentContactName` | No |
| G | Meeting Time | `meetingDay` | No |
| H | Location | `location` | No |
| I | Contact | `studentContactEmail` | No |
| J | Social Media | `socialMedia` | No |
| K | Active | Not used | No |
| L | Notes | `notes` | No |
| M | Keywords | Not used | No |
| N | Meeting Frequency | `meetingFrequency` | No |

## Notes

- Rows without a value in column B are skipped.
- Extra columns beyond N are ignored.
- Imported rows are created as approved registrations in the selected collection.

## Recommended Header Row

`ID | Name | Category | Description | Advisor | Student Leader | Meeting Time | Location | Contact | Social Media | Active | Notes | Keywords | Meeting Frequency`
