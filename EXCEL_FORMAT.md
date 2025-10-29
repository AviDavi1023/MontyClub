# Excel File Format for clubData.xlsx

Your Excel file should have the following columns in this exact order:

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | ID | Unique identifier for each club | 1, 2, 3, etc. |
| B | Name | Club name | "Debate Club" |
| C | Category | Club category | "Academic", "Arts", "STEM", "Service" |
| D | Description | Brief description of the club | "Develop public speaking skills..." |
| E | Advisor | Teacher/staff advisor name | "Ms. Johnson" |
| F | Student Leader | Student leader name(s) | "Alex Chen" |
| G | Meeting Time | When the club meets | "Tuesdays 3:30 PM" |
| H | Location | Where the club meets | "Room 201" |
| I | Contact | Email or contact information | "debate@school.edu" |
| J | Social Media | Social media handle | "@schooldebate" |
| K | Active | Status (Active/Inactive or True/False or 1/0) | "Active" |
| L | Grade Level | Grade levels | "9-12", "10-12" |
| M | Keywords | Comma-separated keywords | "speaking,competition,academic" |

## Important Notes:

1. **First row must be headers** - The first row should contain the column names
2. **No empty rows** - Don't leave empty rows between data
3. **Active status** - Use "Active"/"Inactive", "True"/"False", or "1"/"0"
4. **Keywords** - Separate multiple keywords with commas (no spaces after commas)
5. **File location** - Place the file in the root directory as `clubData.xlsx`

## Sample Data:

| ID | Name | Category | Description | Advisor | Student Leader | Meeting Time | Location | Contact | Social Media | Active | Grade Level | Keywords |
|----|------|----------|-------------|---------|----------------|--------------|----------|--------|--------------|--------|-------------|---------|
| 1 | Debate Club | Academic | Develop public speaking skills | Ms. Johnson | Alex Chen | Tuesdays 3:30 PM | Room 201 | debate@school.edu | @schooldebate | Active | 9-12 | speaking,competition,academic |
| 2 | Robotics Team | STEM | Build and program robots | Mr. Smith | Sarah Kim | Wednesdays 4:00 PM | Tech Lab | robotics@school.edu | @schoolrobotics | Active | 9-12 | engineering,programming,competition |

If the Excel file is not found or has errors, the app will fall back to mock data for demonstration purposes.

## Security Note

This app uses ExcelJS, a secure and actively maintained library for reading Excel files, ensuring your data is processed safely without vulnerabilities.
