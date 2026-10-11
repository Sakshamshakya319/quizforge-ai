# QuizForge AI Database Setup

This project uses MySQL as the primary database.

## Prerequisites

- MySQL 8.0 or later running on your machine or an accessible server.

## Setup Instructions

1. Connect to your MySQL instance as a user with database creation privileges (e.g., `root`).
2. Source the schema file:
   ```sql
   source schema.sql;
   ```
   *Alternatively, if running from the command line:*
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. Create a dedicated user for the application (if you haven't already):
   ```sql
   CREATE USER 'quizforge_user'@'localhost' IDENTIFIED BY 'change_me';
   GRANT ALL PRIVILEGES ON quizforge_ai.* TO 'quizforge_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
4. Update your `.env` file in the root directory to match the credentials you created.

## Migrations

For this initial version, `schema.sql` creates the `quizforge_ai` database and all necessary tables. For subsequent changes, new `.sql` migration files should be added rather than modifying the base schema.

## Cleanup

To completely remove the database (warning: all data will be lost):
```sql
DROP DATABASE quizforge_ai;
```
