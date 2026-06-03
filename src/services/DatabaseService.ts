import SQLite from 'react-native-sqlite-storage';

// Enable promise mode
SQLite.enablePromise(true);

// Create a single database connection to be reused throughout the app
const DB_NAME = 'AntiBodyCheck.db';

// Standardized type names to ensure consistency across the app
export const DB_TYPES = {
  // Database type names (used in database storage)
  ABScreen: 'ABScreen',
  ABIDPanel: 'ABIDPanel',
  SelectCells: 'SelectCells',
  CaseArchives: 'CaseArchives',
};

// Display type names (shown to users)
export const DISPLAY_TYPES = {
  ABScreen: 'ABScreen',
  ABIDPanel: 'ABID Panel',
  SelectCells: 'Select Cells',
  CaseArchives: 'Case Archives',
};

// Mapping from display names to database names
export const DISPLAY_TO_DB_TYPE: Record<string, string> = {
  'ABScreen': DB_TYPES.ABScreen,
  'ABID Panel': DB_TYPES.ABIDPanel,
  'Select Cells': DB_TYPES.SelectCells,
  'Case Archives': DB_TYPES.CaseArchives,
};

// Mapping of possible type variations to standardized types
export const TYPE_VARIATIONS: Record<string, string[]> = {
  [DB_TYPES.ABScreen]: ['ABScreen', 'Screen'],
  [DB_TYPES.ABIDPanel]: ['ABIDPanel', 'ABID Panel', 'ABID'],
  [DB_TYPES.SelectCells]: ['SelectCells', 'Select Cells'],
  [DB_TYPES.CaseArchives]: ['CaseArchives', 'Case Archives'],
};

export interface Panel {
  id: number;
  name: string;
  type: string;
  data: string; // JSON string
  metadata?: string;
  created_at: string;
  modified_at?: string;
}

export interface FileFilter {
  type?: string;
  searchText?: string;
  searchMode?: 'partial' | 'whole';
  limit?: number;
}

export interface AntibodyRule {
  id: number;
  name: string;
  isSelected: 'Yes' | 'No' | 'Not Set';
  isHeterozygous: 'Yes' | 'No' | 'Not Set';
}

class DatabaseService {
  private database: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database connection
   */
  async initDatabase(): Promise<void> {
    // If we already have an initialization promise, return it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create a new initialization promise
    this.initPromise = (async () => {
      try {
        if (this.database) {
          console.log('Database already initialized');
          return;
        }

        console.log('Opening database connection...');
        this.database = await SQLite.openDatabase({
          name: DB_NAME,
          location: 'default'
        });
        
        console.log('Creating tables...');
        await this.createTables();
        console.log('Database initialized successfully');
      } catch (error) {
        // Reset the database and initPromise on error
        this.database = null;
        this.initPromise = null;
        console.error('Error initializing database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Create required database tables if they don't exist
   */
  private async createTables(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Create panels table
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS panels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          type TEXT,
          data TEXT,
          metadata TEXT,
          created_at TEXT,
          modified_at TEXT
        )
      `);
      
      // Create settings table
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      
      // Create antibody rules table
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS antibody_rules (
          id INTEGER PRIMARY KEY,
          name TEXT,
          isSelected TEXT,
          isHeterozygous TEXT
        )
      `);
      
      // Create case_reports table if it doesn't exist
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS case_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_name TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          sample_id TEXT,
          draw_date TEXT,
          conclusion TEXT,
          notes TEXT,
          technician TEXT,
          created_at TEXT NOT NULL,
          first_panel_id TEXT,
          second_panel_id TEXT,
          report_data TEXT NOT NULL
        )
      `);

      // Log table schemas for debugging
      console.log('Tables created successfully');
      this.logTableSchema('case_reports');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Logs table schema for debugging purposes
   */
  private async logTableSchema(tableName: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    
    try {
      const [result] = await this.database.executeSql(`PRAGMA table_info(${tableName})`);
      console.log(`Schema for table ${tableName}:`);
      
      for (let i = 0; i < result.rows.length; i++) {
        const column = result.rows.item(i);
        console.log(`  ${column.name} (${column.type}) ${column.pk ? 'PRIMARY KEY' : ''}`);
      }
    } catch (error) {
      console.error(`Error getting schema for ${tableName}:`, error);
    }
  }

  /**
   * Ensures database is ready before executing the given function
   */
  private async ensureDatabase<T>(operation: () => Promise<T>): Promise<T> {
    try {
      // Make sure database is initialized
      await this.initDatabase();
      
      if (!this.database) {
        throw new Error('Database not initialized');
      }
      
      // Execute the operation
      return await operation();
    } catch (error) {
      console.error('Database operation error:', error);
      throw error;
    }
  }

  /**
   * Normalizes a folder type name to its standard database type
   */
  private normalizeTypeName(typeName: string): string {
    // Check if it's already a standard DB type
    if (Object.values(DB_TYPES).includes(typeName)) {
      return typeName;
    }
    
    // Check in the DISPLAY_TO_DB_TYPE mapping
    if (DISPLAY_TO_DB_TYPE[typeName]) {
      return DISPLAY_TO_DB_TYPE[typeName];
    }
    
    // Check in type variations
    for (const [standardType, variations] of Object.entries(TYPE_VARIATIONS)) {
      if (variations.includes(typeName)) {
        return standardType;
      }
    }
    
    // If not found, return the original name
    return typeName;
  }

  /**
   * Get files based on filter criteria
   */
  async getFiles(filter: FileFilter = {}): Promise<Panel[]> {
    return this.ensureDatabase(async () => {
      try {
        const { type, searchText, searchMode } = filter;
        
        let query = 'SELECT * FROM panels';
        const params: string[] = [];
        
        if (type) {
          // Normalize the type name
          const normalizedType = this.normalizeTypeName(type);
          query += ' WHERE type = ?';
          params.push(normalizedType);
          
          if (searchText) {
            if (searchMode === 'whole') {
              query += ' AND (name = ? OR metadata LIKE ?)';
              params.push(searchText, `%"${searchText}"%`);
            } else {
              query += ' AND (name LIKE ? OR metadata LIKE ?)';
              params.push(`%${searchText}%`, `%"${searchText}"%`);
            }
          }
        } else if (searchText) {
          if (searchMode === 'whole') {
            query += ' WHERE (name = ? OR metadata LIKE ?)';
            params.push(searchText, `%"${searchText}"%`);
          } else {
            query += ' WHERE (name LIKE ? OR metadata LIKE ?)';
            params.push(`%${searchText}%`, `%"${searchText}"%`);
          }
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [results] = await this.database!.executeSql(query, params);
        const files: Panel[] = [];
        
        for (let i = 0; i < results.rows.length; i++) {
          files.push(results.rows.item(i));
        }
        
        return files;
      } catch (error) {
        console.error('Error getting files:', error);
        return [];
      }
    });
  }

  /**
   * Get a file by its ID
   * @param id - The ID of the file to retrieve
   * @returns Promise that resolves to the file or null if not found
   */
  async getFileById(id: number): Promise<Panel | null> {
    return this.ensureDatabase(async () => {
      const [result] = await this.database!.executeSql(
        'SELECT * FROM panels WHERE id = ?;',
        [id]
      );
      
      if (result.rows.length > 0) {
        return result.rows.item(0);
      } else {
        return null;
      }
    });
  }

  /**
   * Delete a file by ID
   */
  async deleteFile(id: number): Promise<void> {
    return this.ensureDatabase(async () => {
      await this.database!.executeSql(
        'DELETE FROM panels WHERE id = ?',
        [id]
      );
    });
  }

  /**
   * Update a file's folder (type)
   */
  async moveFile(id: number, newType: string): Promise<void> {
    return this.ensureDatabase(async () => {
      // Normalize the type name
      const normalizedType = this.normalizeTypeName(newType);
      
      await this.database!.executeSql(
        'UPDATE panels SET type = ? WHERE id = ?',
        [normalizedType, id]
      );
    });
  }

  /**
   * Save a new file
   */
  async saveFile(file: Omit<Panel, 'id'>): Promise<number> {
    return this.ensureDatabase(async () => {
      // Normalize the type name
      const normalizedType = this.normalizeTypeName(file.type);
      
      const [result] = await this.database!.executeSql(
        'INSERT INTO panels (name, type, data, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
        [file.name, normalizedType, file.data, file.metadata || null, file.created_at]
      );
      return result.insertId;
    });
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(ids: number[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();

    return this.ensureDatabase(async () => {
      const placeholders = ids.map(() => '?').join(',');
      
      await this.database!.executeSql(
        `DELETE FROM panels WHERE id IN (${placeholders})`,
        ids
      );
    });
  }

  /**
   * Move multiple files to a new folder
   */
  async moveMultipleFiles(ids: number[], newType: string): Promise<void> {
    if (ids.length === 0) return Promise.resolve();

    return this.ensureDatabase(async () => {
      const placeholders = ids.map(() => '?').join(',');
      
      // Normalize the type name
      const normalizedType = this.normalizeTypeName(newType);
      
      await this.database!.executeSql(
        `UPDATE panels SET type = ? WHERE id IN (${placeholders})`,
        [normalizedType, ...ids]
      );
    });
  }

  /**
   * Get files that match any of the provided types
   * Special method to handle cases where a folder might have files with different type values
   */
  async getFilesWithMultipleTypes(
    types: string[],
    searchText?: string,
    searchMode: 'partial' | 'whole' = 'partial'
  ): Promise<Panel[]> {
    // Normalize all type names
    const normalizedTypes = types.map(type => this.normalizeTypeName(type));
    
    // Build the WHERE clause for multiple types using OR
    const typeConditions = normalizedTypes.map(() => 'type = ?').join(' OR ');
    const typesWhereClause = normalizedTypes.length > 0 ? `(${typeConditions})` : '';
    
    // Add search text filtering if provided
    let searchCondition = '';
    const params: any[] = [...normalizedTypes]; // Start with the type parameters
    
    if (searchText) {
      searchCondition = searchMode === 'whole' 
        ? 'name = ?' 
        : 'name LIKE ?';
      
      params.push(searchMode === 'whole' 
        ? searchText 
        : `%${searchText}%`);
    }
    
    // Build final WHERE clause
    let whereClause = '';
    if (typesWhereClause && searchCondition) {
      whereClause = `WHERE ${typesWhereClause} AND ${searchCondition}`;
    } else if (typesWhereClause) {
      whereClause = `WHERE ${typesWhereClause}`;
    } else if (searchCondition) {
      whereClause = `WHERE ${searchCondition}`;
    }
    
    return this.ensureDatabase(async () => {
      const files: Panel[] = [];
      
      const [results] = await this.database!.executeSql(
        `SELECT * FROM panels ${whereClause} ORDER BY created_at DESC;`,
        params
      );
      
      const len = results.rows.length;
      for (let i = 0; i < len; i++) {
        files.push(results.rows.item(i));
      }
      
      return files;
    });
  }

  /**
   * Gets a setting value from the database
   */
  async getSetting(key: string): Promise<{ key: string, value: string } | null> {
    return this.ensureDatabase(async () => {
      try {
        const [result] = await this.database!.executeSql(
          'SELECT key, value FROM settings WHERE key = ?',
          [key]
        );
        
        if (result.rows.length > 0) {
          return result.rows.item(0);
        }
        
        return null;
      } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return null;
      }
    });
  }

  /**
   * Saves a setting value to the database
   */
  async saveSetting(key: string, value: string): Promise<void> {
    return this.ensureDatabase(async () => {
      try {
        await this.database!.executeSql(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, value]
        );
      } catch (error) {
        console.error(`Error saving setting ${key}:`, error);
        throw error;
      }
    });
  }

  /**
   * Gets all antibody rules from the database
   */
  async getAntibodyRules(): Promise<AntibodyRule[]> {
    return this.ensureDatabase(async () => {
      try {
        const [result] = await this.database!.executeSql(
          'SELECT id, name, isSelected, isHeterozygous FROM antibody_rules ORDER BY id'
        );
        
        const rules: AntibodyRule[] = [];
        
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          rules.push({
            id: row.id,
            name: row.name,
            isSelected: row.isSelected,
            isHeterozygous: row.isHeterozygous
          });
        }
        
        return rules;
      } catch (error) {
        console.error('Error getting antibody rules:', error);
        return [];
      }
    });
  }

  /**
   * Saves antibody rules to the database
   */
  async saveAntibodyRules(rules: AntibodyRule[]): Promise<void> {
    return this.ensureDatabase(async () => {
      try {
        // Begin transaction
        await this.database!.executeSql('BEGIN TRANSACTION');
        
        // Delete all existing rules
        await this.database!.executeSql('DELETE FROM antibody_rules');
        
        // Insert new rules
        for (const rule of rules) {
          await this.database!.executeSql(
            'INSERT INTO antibody_rules (id, name, isSelected, isHeterozygous) VALUES (?, ?, ?, ?)',
            [rule.id, rule.name, rule.isSelected, rule.isHeterozygous]
          );
        }
        
        // Commit transaction
        await this.database!.executeSql('COMMIT');
      } catch (error) {
        // Rollback transaction on error
        if (this.database) {
          await this.database.executeSql('ROLLBACK');
        }
        console.error('Error saving antibody rules:', error);
        throw error;
      }
    });
  }

  /**
   * Creates the users table if it doesn't exist
   */
  async createUserTable(): Promise<void> {
    return this.ensureDatabase(async () => {
      try {
        await this.database!.executeSql(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            created_at TEXT
          )
        `);
        console.log('User table created or already exists');
      } catch (error) {
        console.error('Error creating user table:', error);
        throw error;
      }
    });
  }

  /**
   * Get a user by their email address
   * @param email The email to look up
   * @returns The user object or null if not found
   */
  async getUserByEmail(email: string): Promise<any | null> {
    return this.ensureDatabase(async () => {
      try {
        // Make sure user table exists
        await this.createUserTable();
        
        const [result] = await this.database!.executeSql(
          'SELECT * FROM users WHERE email = ?',
          [email]
        );
        
        if (result.rows.length > 0) {
          return result.rows.item(0);
        }
        
        return null;
      } catch (error) {
        console.error('Error finding user:', error);
        return null;
      }
    });
  }

  /**
   * Create a new user account
   * @param email User's email address
   * @param password User's password
   * @returns Object with success status and message
   */
  async createUser(email: string, password: string): Promise<{ success: boolean; message: string }> {
    return this.ensureDatabase(async () => {
      try {
        // Make sure user table exists
        await this.createUserTable();
        
        // Check if user already exists
        const existingUser = await this.getUserByEmail(email);
        if (existingUser) {
          return { success: false, message: 'User with this email already exists' };
        }
        
        // Insert new user
        const [result] = await this.database!.executeSql(
          'INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)',
          [email, password, new Date().toISOString()]
        );
        
        if (result.rowsAffected > 0) {
          return { success: true, message: 'Account created successfully' };
        } else {
          return { success: false, message: 'Error creating account' };
        }
      } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, message: 'Database error occurred' };
      }
    });
  }

  /**
   * Authenticate a user
   * @param email User's email address
   * @param password User's password
   * @returns Object with success status and message
   */
  async loginUser(email: string, password: string): Promise<{ success: boolean; message: string; userId?: number }> {
    return this.ensureDatabase(async () => {
      try {
        // Make sure user table exists
        await this.createUserTable();
        
        const [result] = await this.database!.executeSql(
          'SELECT * FROM users WHERE email = ? AND password = ?',
          [email, password]
        );
        
        if (result.rows.length > 0) {
          const user = result.rows.item(0);
          return { 
            success: true, 
            message: 'Login successful',
            userId: user.id
          };
        } else {
          return { success: false, message: 'Invalid email or password' };
        }
      } catch (error) {
        console.error('Error during login:', error);
        return { success: false, message: 'Database error occurred' };
      }
    });
  }

  /**
   * Get all files - instance method replacing the static method
   */
  async getAllFiles(): Promise<Panel[]> {
    return this.ensureDatabase(async () => {
      try {
        const [results] = await this.database!.executeSql('SELECT * FROM panels');
        const files: Panel[] = [];
        
        for (let i = 0; i < results.rows.length; i++) {
          files.push(results.rows.item(i));
        }
        
        return files;
      } catch (error) {
        console.error('Error getting all files:', error);
        return [];
      }
    });
  }

  /**
   * Execute a custom query - instance method replacing the static method
   */
  async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    return this.ensureDatabase(async () => {
      try {
        const [results] = await this.database!.executeSql(query, params);
        const rows = [];
        
        for (let i = 0; i < results.rows.length; i++) {
          rows.push(results.rows.item(i));
        }
        
        return rows;
      } catch (error) {
        console.error('Error executing query:', error);
        throw error;
      }
    });
  }

  /**
   * Check for expired panels and move them to Select Cells folder
   * Fixed to prevent duplicate entries and handle type variations
   */
  async checkForExpiredPanels(): Promise<void> {
    return this.ensureDatabase(async () => {
      try {
        console.log('Checking for expired panels...');
        
        // Get all panels that might be ABScreen or ABIDPanel types
        const abScreenTypes = TYPE_VARIATIONS[DB_TYPES.ABScreen];
        const abidPanelTypes = TYPE_VARIATIONS[DB_TYPES.ABIDPanel];
        
        // Query for panels with any of the relevant types
        const typePlaceholders = [...abScreenTypes, ...abidPanelTypes].map(() => '?').join(',');
        const [results] = await this.database!.executeSql(
          `SELECT * FROM panels WHERE type IN (${typePlaceholders})`,
          [...abScreenTypes, ...abidPanelTypes]
        );
        
        const panelsToCheck: Panel[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          panelsToCheck.push(results.rows.item(i));
        }
        
        console.log(`Found ${panelsToCheck.length} panels to check for expiration`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        // Check each panel for expiration
        const expiredPanelIds: number[] = [];
        
        // Function to check a panel and add to expiredPanelIds if expired
        const checkAndAddExpired = (panel: Panel) => {
          try {
            if (panel && panel.data) {
              const panelData = JSON.parse(panel.data);
              if (panelData.metadata?.expirationDate) {
                const expirationDate = new Date(panelData.metadata.expirationDate);
                console.log(`Checking panel ${panel.id}, expiration: ${panelData.metadata.expirationDate}, parsed as: ${expirationDate.toISOString()}`);
                
                if (expirationDate <= today) {
                  expiredPanelIds.push(panel.id);
                  console.log(`Panel ${panel.id} is expired and will be moved`);
                }
              } else {
                console.log(`Panel ${panel.id} has no expiration date`);
              }
            }
          } catch (error) {
            console.error(`Error processing panel ${panel?.id}:`, error);
          }
        };
        
        // Process all panels
        for (const panel of panelsToCheck) {
          checkAndAddExpired(panel);
        }
        
        // Move expired panels to Select Cells
        if (expiredPanelIds.length > 0) {
          await this.moveMultipleFiles(expiredPanelIds, DB_TYPES.SelectCells);
          console.log(`Moved ${expiredPanelIds.length} expired panels to Select Cells`);
        } else {
          console.log('No expired panels found');
        }
      } catch (error) {
        console.error('Error checking for expired panels:', error);
      }
    });
  }

  /**
   * Save a case report
   */
  async saveCaseReport(reportData: {
    patientName: string;
    patientId: string;
    sampleId?: string;
    drawDate?: string;
    conclusion?: string;
    notes?: string;
    technician?: string;
    createdAt: string;
    firstPanelId?: string;
    secondPanelId?: string;
    reportData: string;
  }): Promise<string | null> {
    try {
      console.log('Saving case report with data:', {
        patientName: reportData.patientName,
        patientId: reportData.patientId,
        sampleId: reportData.sampleId,
        createdAt: reportData.createdAt
      });
      
      await this.initDatabase();
      
      if (!this.database) {
        console.error('Database not initialized in saveCaseReport');
        return null;
      }
      
      try {
        // Begin transaction for better error handling
        await this.database.executeSql('BEGIN TRANSACTION');
        
        // Insert the report data
        const [result] = await this.database.executeSql(
          `INSERT INTO case_reports (
            patient_name, patient_id, sample_id, draw_date, 
            conclusion, notes, technician, created_at,
            first_panel_id, second_panel_id, report_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportData.patientName,
            reportData.patientId,
            reportData.sampleId || '',
            reportData.drawDate || '',
            reportData.conclusion || '',
            reportData.notes || '',
            reportData.technician || '',
            reportData.createdAt,
            reportData.firstPanelId || null,
            reportData.secondPanelId || null,
            reportData.reportData
          ]
        );
        
        // Commit the transaction
        await this.database.executeSql('COMMIT');
        
        // Get the inserted ID
        const insertId = result?.insertId?.toString() || null;
        console.log('Case report saved with ID:', insertId);
        
        // Verify the report was saved
        if (insertId) {
          const savedReport = await this.getCaseReportById(insertId);
          console.log('Verification - saved report exists:', savedReport !== null);
        }
        
        return insertId;
      } catch (error) {
        // Rollback on error
        if (this.database) {
          await this.database.executeSql('ROLLBACK');
        }
        console.error('SQL error in saveCaseReport:', error);
        return null;
      }
    } catch (error) {
      console.error('Error saving case report:', error);
      return null;
    }
  }

  /**
   * Get case report by ID
   */
  async getCaseReportById(reportId: string): Promise<any | null> {
    try {
      console.log('Getting case report by ID:', reportId);
      await this.initDatabase();
      
      if (!this.database) {
        console.error('Database not initialized in getCaseReportById');
        return null;
      }
      
      const [results] = await this.database.executeSql(
        `SELECT * FROM case_reports WHERE id = ?`,
        [reportId]
      );
      
      if (results?.rows.length > 0) {
        const report = results.rows.item(0);
        console.log(`Found report with ID ${reportId}`);
        return report;
      } else {
        console.log(`No report found with ID ${reportId}`);
        return null;
      }
    } catch (error) {
      console.error('Error getting case report:', error);
      return null;
    }
  }

  /**
   * Get all case reports for the Case Archives folder
   */
  async getCaseReports(searchText?: string): Promise<any[]> {
    try {
      console.log('Getting all case reports, search:', searchText || 'none');
      await this.initDatabase();
      
      if (!this.database) {
        console.error('Database not initialized in getCaseReports');
        return [];
      }
      
      let query = `SELECT * FROM case_reports`;
      const params = [];
      
      // Add search condition if needed
      if (searchText) {
        query += ` WHERE patient_name LIKE ? OR patient_id LIKE ?`;
        params.push(`%${searchText}%`, `%${searchText}%`);
      }
      
      // Order by creation date (newest first)
      query += ` ORDER BY created_at DESC`;
      
      const [results] = await this.database.executeSql(query, params);
      
      // Convert result set to array
      const reports = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        reports.push({
          id: item.id,
          name: `${item.patient_name} (${item.patient_id})`,
          type: DB_TYPES.CaseArchives,
          created_at: item.created_at,
          data: item.report_data
        });
      }
      
      console.log(`Found ${reports.length} case reports`);
      return reports;
    } catch (error) {
      console.error('Error getting case reports:', error);
      return [];
    }
  }

  /**
   * Delete a case report by ID
   */
  async deleteCaseReport(reportId: string): Promise<boolean> {
    try {
      console.log('Deleting case report with ID:', reportId);
      await this.initDatabase();
      
      if (!this.database) {
        console.error('Database not initialized in deleteCaseReport');
        return false;
      }
      
      const [result] = await this.database.executeSql(
        `DELETE FROM case_reports WHERE id = ?`,
        [reportId]
      );
      
      const success = result.rowsAffected > 0;
      console.log(`Case report deletion ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error deleting case report:', error);
      return false;
    }
  }
}

export default new DatabaseService();