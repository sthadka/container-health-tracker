/**
 * ConfigService
 *
 * Reads configuration from Apps Script Properties Service
 * Per constitution: Declarative Configuration
 * Per research.md: Configuration Management
 */

/**
 * Configuration keys stored in Apps Script Properties
 */
export enum ConfigKey {
  SPREADSHEET_ID = 'SPREADSHEET_ID',
  API_ENDPOINT = 'API_ENDPOINT',
  EMAIL_RECIPIENTS = 'EMAIL_RECIPIENTS',
  SLACK_WEBHOOK_URL = 'SLACK_WEBHOOK_URL',
  SLACK_MENTION_USERS = 'SLACK_MENTION_USERS',
  NOTIFICATION_ENABLED = 'NOTIFICATION_ENABLED',
  ENABLE_EMAIL = 'ENABLE_EMAIL',
  ENABLE_SLACK = 'ENABLE_SLACK',
  SEVERITY_THRESHOLD = 'SEVERITY_THRESHOLD',
  NOTIFY_ONLY_ON_STATUS_CHANGE = 'NOTIFY_ONLY_ON_STATUS_CHANGE',
  INCLUDE_DETAILED_PACKAGE_LIST = 'INCLUDE_DETAILED_PACKAGE_LIST',
  LOG_LEVEL = 'LOG_LEVEL'
}

import { Severity } from '../models/types';

/**
 * Configuration interface
 */
export interface AppConfig {
  spreadsheetId: string;
  apiEndpoint: string;
  emailRecipients: string[];
  slackWebhookUrl?: string;
  slackMentionUsers: string[];
  notificationEnabled: boolean;
  enableEmail: boolean;
  enableSlack: boolean;
  severityThreshold: Severity;
  notifyOnlyOnStatusChange: boolean;
  includeDetailedPackageList: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Default configuration values
 */
const DEFAULTS: Partial<AppConfig> = {
  apiEndpoint: 'https://catalog.redhat.com/api/containers/graphql/',
  notificationEnabled: true,
  enableEmail: true,
  enableSlack: false,
  severityThreshold: Severity.IMPORTANT,
  notifyOnlyOnStatusChange: true,
  includeDetailedPackageList: false,
  logLevel: 'INFO',
  slackMentionUsers: []
};

/**
 * ConfigService class
 *
 * Provides strongly-typed access to Apps Script Properties
 * Validates required configuration on initialization
 */
export class ConfigService {
  private properties: GoogleAppsScript.Properties.Properties;
  private config: AppConfig | null = null;

  constructor() {
    // Use PropertiesService to access script properties
    this.properties = PropertiesService.getScriptProperties();
  }

  /**
   * Initialize and validate configuration
   * Throws error if required properties are missing
   */
  public initialize(): void {
    const spreadsheetId = this.properties.getProperty(ConfigKey.SPREADSHEET_ID);

    if (!spreadsheetId) {
      throw new Error('Missing required configuration: SPREADSHEET_ID. Run initializeProperties() first.');
    }

    // Load all configuration values
    this.config = {
      spreadsheetId,
      apiEndpoint: this.properties.getProperty(ConfigKey.API_ENDPOINT) || DEFAULTS.apiEndpoint!,
      emailRecipients: this.parseEmailRecipients(),
      slackWebhookUrl: this.properties.getProperty(ConfigKey.SLACK_WEBHOOK_URL) || undefined,
      slackMentionUsers: this.parseSlackMentionUsers(),
      notificationEnabled: this.parseBoolean(ConfigKey.NOTIFICATION_ENABLED, DEFAULTS.notificationEnabled!),
      enableEmail: this.parseBoolean(ConfigKey.ENABLE_EMAIL, DEFAULTS.enableEmail!),
      enableSlack: this.parseBoolean(ConfigKey.ENABLE_SLACK, DEFAULTS.enableSlack!),
      severityThreshold: this.parseSeverityThreshold(),
      notifyOnlyOnStatusChange: this.parseBoolean(ConfigKey.NOTIFY_ONLY_ON_STATUS_CHANGE, DEFAULTS.notifyOnlyOnStatusChange!),
      includeDetailedPackageList: this.parseBoolean(ConfigKey.INCLUDE_DETAILED_PACKAGE_LIST, DEFAULTS.includeDetailedPackageList!),
      logLevel: this.parseLogLevel()
    };
  }

  /**
   * Get current configuration
   * Throws error if not initialized
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('ConfigService not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Get specific configuration value
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.getConfig()[key];
  }

  /**
   * Update configuration property
   * Used for runtime configuration changes
   */
  public set(key: ConfigKey, value: string): void {
    this.properties.setProperty(key, value);
    // Invalidate cache
    this.config = null;
  }

  /**
   * Parse email recipients from comma-separated string
   */
  private parseEmailRecipients(): string[] {
    const recipients = this.properties.getProperty(ConfigKey.EMAIL_RECIPIENTS);
    if (!recipients) {
      return [];
    }
    return recipients.split(',').map(email => email.trim()).filter(email => email.length > 0);
  }

  /**
   * Parse Slack mention users from comma-separated string
   */
  private parseSlackMentionUsers(): string[] {
    const users = this.properties.getProperty(ConfigKey.SLACK_MENTION_USERS);
    if (!users) {
      return DEFAULTS.slackMentionUsers!;
    }
    return users.split(',').map(user => user.trim()).filter(user => user.length > 0);
  }

  /**
   * Parse severity threshold with validation
   */
  private parseSeverityThreshold(): Severity {
    const threshold = this.properties.getProperty(ConfigKey.SEVERITY_THRESHOLD);
    if (!threshold) {
      return DEFAULTS.severityThreshold!;
    }

    const validSeverities: Severity[] = [
      Severity.CRITICAL,
      Severity.IMPORTANT,
      Severity.MODERATE,
      Severity.LOW,
      Severity.NONE
    ];

    const matchedSeverity = validSeverities.find(s => s === threshold);
    return matchedSeverity || DEFAULTS.severityThreshold!;
  }

  /**
   * Parse boolean property with default value
   */
  private parseBoolean(key: ConfigKey, defaultValue: boolean): boolean {
    const value = this.properties.getProperty(key);
    if (!value) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }

  /**
   * Parse log level with validation
   */
  private parseLogLevel(): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
    const level = this.properties.getProperty(ConfigKey.LOG_LEVEL) || DEFAULTS.logLevel!;
    const validLevels: Array<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'> = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

    if (!validLevels.includes(level as any)) {
      return DEFAULTS.logLevel!;
    }

    return level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  }
}

/**
 * Initialize Apps Script Properties with default values
 * Call this function manually from Apps Script editor to set up configuration
 *
 * @param spreadsheetId - Google Sheets spreadsheet ID
 */
export function initializeProperties(spreadsheetId: string): void {
  const properties = PropertiesService.getScriptProperties();

  properties.setProperties({
    [ConfigKey.SPREADSHEET_ID]: spreadsheetId,
    [ConfigKey.API_ENDPOINT]: DEFAULTS.apiEndpoint!,
    [ConfigKey.NOTIFICATION_ENABLED]: String(DEFAULTS.notificationEnabled),
    [ConfigKey.ENABLE_EMAIL]: String(DEFAULTS.enableEmail),
    [ConfigKey.ENABLE_SLACK]: String(DEFAULTS.enableSlack),
    [ConfigKey.SEVERITY_THRESHOLD]: DEFAULTS.severityThreshold!,
    [ConfigKey.NOTIFY_ONLY_ON_STATUS_CHANGE]: String(DEFAULTS.notifyOnlyOnStatusChange),
    [ConfigKey.INCLUDE_DETAILED_PACKAGE_LIST]: String(DEFAULTS.includeDetailedPackageList),
    [ConfigKey.LOG_LEVEL]: DEFAULTS.logLevel!,
    // EMAIL_RECIPIENTS, SLACK_WEBHOOK_URL, and SLACK_MENTION_USERS set manually by user
  });

  Logger.log('Apps Script Properties initialized successfully');
  Logger.log('SPREADSHEET_ID: ' + spreadsheetId);
  Logger.log('Please set EMAIL_RECIPIENTS and optionally SLACK_WEBHOOK_URL and SLACK_MENTION_USERS via Script Properties');
}
