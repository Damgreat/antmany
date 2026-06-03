# AntiBodyCheck Database Documentation

## Overview

This document describes the database architecture used in the AntiBodyCheck application. The application uses React Native SQLite Storage for local data persistence with a single shared database connection.

## Database Architecture

### Connection Management

- A single database connection is maintained in `src/services/DatabaseService.ts`
- This connection is exported and reused across the application
- The database file is named `antibodycheck.db`

```typescript
// From src/services/DatabaseService.ts
const DB_NAME = 'antibodycheck.db';
export const db = openDatabase(
  { name: DB_NAME, location: 'default' },
  () => console.log('Database connection established successfully'),
  error => console.error('Error opening database:', error)
);
```

### Database Structure

The main database file contains the following tables:

#### panels

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-incremented |
| name | TEXT | Panel/file name |
| type | TEXT | Panel type (folder name: ABScreen, ABID Panel, Select Cells, Case Archives) |
| data | TEXT | JSON string containing panel data |
| created_at | TEXT | Timestamp of creation |

```sql
CREATE TABLE IF NOT EXISTS panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  type TEXT,
  data TEXT,
  created_at TEXT
);
```

## Service Layer

### DatabaseService.ts

This is the central service that provides a clean API for database operations:

```typescript
export const DatabaseService = {
  initDatabase: (): Promise<void> { ... },
  getFiles: (filter: FileFilter = {}): Promise<Panel[]> { ... },
  getFileById: (id: number): Promise<Panel | null> { ... },
  deleteFile: (id: number): Promise<void> { ... },
  moveFile: (id: number, newType: string): Promise<void> { ... },
  saveFile: (file: Omit<Panel, 'id'>): Promise<number> { ... },
  deleteMultipleFiles: (ids: number[]): Promise<void> { ... },
  moveMultipleFiles: (ids: number[], newType: string): Promise<void> { ... }
};
```

### databaseUtils.ts

Utility functions that use the shared database connection:

```typescript
export const initDatabase = (): Promise<void> { ... }
export const getAllPanels = (): Promise<PanelItem[]> { ... }
export const getPanelsByType = (type: string): Promise<PanelItem[]> { ... }
export const deletePanel = (id: string): Promise<void> { ... }
export const deletePanels = (ids: string[]): Promise<void> { ... }
export const updatePanelType = (id: string, newType: string): Promise<void> { ... }
export const updatePanelTypes = (ids: string[], newType: string): Promise<void> { ... }
```

## Key Database Operations

### File Management
- Getting files by folder type
- Moving files between folders
- Deleting files (single or multiple)
- Searching files with filtering options

### Search Operations
- Partial match search
- Whole word search

## UI Integration

## Recent Changes

1. **Database Connection Refactoring**:
   - Created a single database connection instance in `DatabaseService.ts`
   - Updated components to use this shared connection
   - Removed duplicate database connections from different files

2. **Type Definitions**:
   - Added proper TypeScript definitions for SQLite operations
   - Created a declaration file for react-native-sqlite-storage

3. **UI Improvements**:
   - Added loading indicators during database operations
   - Empty state displays when folders have no files
   - Consistent modals for file operations

## Development Guidelines

1. **Database Access**:
   - Always use the `DatabaseService` or `databaseUtils` for database operations
   - Never create new database connections

2. **Error Handling**:
   - Always wrap database operations in try/catch blocks
   - Show appropriate UI feedback during and after operations

3. **Adding New Features**:
   - If adding new database tables, update the initialization in `DatabaseService.ts`
   - When adding new screens, reuse existing database services

4. **Performance Considerations**:
   - For large operations, consider using transactions
   - Avoid unnecessary database queries
   - Use the appropriate methods for bulk operations 