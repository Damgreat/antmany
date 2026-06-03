import { loadRuleSettings } from '../utils/ruleOutUtils';

/**
 * Helper class to ensure rule settings are loaded at app startup
 */
class RuleSettingsHelper {
  private initialized: boolean = false;

  /**
   * Initialize and load rule settings
   * @returns Promise that resolves when settings are loaded
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load rule-out settings from database
      await loadRuleSettings();
      this.initialized = true;
      console.log('Rule settings initialized successfully');
    } catch (error) {
      console.error('Failed to initialize rule settings:', error);
      throw error;
    }
  }
  
  /**
   * Check if rule settings have been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Force a reload of rule settings
   */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}

// Singleton instance
export default new RuleSettingsHelper();