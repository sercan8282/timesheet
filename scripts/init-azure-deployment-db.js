/**
 * Azure VM Deployment Tool - Database Initialization Script
 * This script creates the necessary database tables for the Azure VM deployment automation tool
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.db");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log("Connected to database for Azure deployment initialization");
});

// Create tables for Azure VM deployment tool
db.serialize(() => {
  // Azure credentials and configuration
  db.run(
    `CREATE TABLE IF NOT EXISTS azure_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment TEXT NOT NULL UNIQUE, -- 'production', 'acceptance'
      tenant_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating azure_credentials table:", err);
      else console.log("✓ azure_credentials table created");
    }
  );

  // Storage account configuration for Terraform state files
  db.run(
    `CREATE TABLE IF NOT EXISTS terraform_state_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment TEXT NOT NULL UNIQUE, -- 'production', 'acceptance'
      storage_account_name TEXT NOT NULL,
      container_name TEXT NOT NULL,
      resource_group TEXT NOT NULL,
      access_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating terraform_state_config table:", err);
      else console.log("✓ terraform_state_config table created");
    }
  );

  // VM naming patterns by server type
  db.run(
    `CREATE TABLE IF NOT EXISTS vm_naming_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_type TEXT NOT NULL UNIQUE, -- 'application', 'sql', 'web', etc.
      naming_pattern TEXT NOT NULL, -- 'nlvmapp', 'nlvmdb', 'nlvmweb', etc.
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating vm_naming_patterns table:", err);
      else console.log("✓ vm_naming_patterns table created");
    }
  );

  // Azure DevOps configuration
  db.run(
    `CREATE TABLE IF NOT EXISTS azure_devops_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment TEXT NOT NULL UNIQUE, -- 'production', 'acceptance'
      organization TEXT NOT NULL,
      project TEXT NOT NULL,
      repository TEXT NOT NULL,
      personal_access_token TEXT NOT NULL,
      default_branch TEXT DEFAULT 'main',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating azure_devops_config table:", err);
      else console.log("✓ azure_devops_config table created");
    }
  );

  // Pipeline configuration per environment and server type
  db.run(
    `CREATE TABLE IF NOT EXISTS pipeline_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment TEXT NOT NULL, -- 'production', 'acceptance'
      server_type TEXT NOT NULL, -- 'application', 'sql', 'web'
      pipeline_name TEXT NOT NULL,
      pipeline_id INTEGER,
      terraform_path TEXT DEFAULT 'terraform',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(environment, server_type)
    )`,
    (err) => {
      if (err) console.error("Error creating pipeline_config table:", err);
      else console.log("✓ pipeline_config table created");
    }
  );

  // Repository configuration per server type
  db.run(
    `CREATE TABLE IF NOT EXISTS repository_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_type TEXT NOT NULL UNIQUE, -- 'application', 'sql', 'web'
      organization TEXT NOT NULL,
      project TEXT NOT NULL,
      repository TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating repository_config table:", err);
      else console.log("✓ repository_config table created");
    }
  );

  // VM deployment history
  db.run(
    `CREATE TABLE IF NOT EXISTS vm_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vm_name TEXT NOT NULL,
      environment TEXT NOT NULL,
      server_type TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      resource_group TEXT NOT NULL,
      vm_size TEXT NOT NULL,
      virtual_network TEXT NOT NULL,
      subnet TEXT,
      os_disk_size INTEGER,
      data_disks_count INTEGER DEFAULT 0,
      data_disk_sizes TEXT, -- JSON array of disk sizes
      status TEXT DEFAULT 'pending', -- 'pending', 'deploying', 'completed', 'failed'
      branch_name TEXT,
      pipeline_run_id TEXT,
      terraform_generated_path TEXT,
      error_message TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    (err) => {
      if (err) console.error("Error creating vm_deployments table:", err);
      else console.log("✓ vm_deployments table created");
    }
  );

  // Email notification settings for deployments
  db.run(
    `CREATE TABLE IF NOT EXISTS deployment_email_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enabled INTEGER DEFAULT 1,
      notify_on_start INTEGER DEFAULT 1,
      notify_on_completion INTEGER DEFAULT 1,
      notify_on_failure INTEGER DEFAULT 1,
      recipient_emails TEXT NOT NULL, -- JSON array of email addresses
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Error creating deployment_email_config table:", err);
      else console.log("✓ deployment_email_config table created");
    }
  );

  // Insert default VM naming patterns
  const defaultPatterns = [
    { server_type: "application", naming_pattern: "nlvmapp", description: "Application Server" },
    { server_type: "sql", naming_pattern: "nlvmdb", description: "SQL Database Server" },
    { server_type: "web", naming_pattern: "nlvmweb", description: "Web Server" },
    { server_type: "file", naming_pattern: "nlvmfile", description: "File Server" },
    { server_type: "domain", naming_pattern: "nlvmdc", description: "Domain Controller" },
  ];

  const insertPattern = db.prepare(
    `INSERT OR IGNORE INTO vm_naming_patterns (server_type, naming_pattern, description) 
     VALUES (?, ?, ?)`
  );

  defaultPatterns.forEach((pattern) => {
    insertPattern.run(pattern.server_type, pattern.naming_pattern, pattern.description);
  });

  insertPattern.finalize(() => {
    console.log("✓ Default VM naming patterns inserted");
  });

  // Insert default email configuration
  db.run(
    `INSERT OR IGNORE INTO deployment_email_config (id, recipient_emails) 
     VALUES (1, '["admin@example.com"]')`,
    (err) => {
      if (err) console.error("Error inserting default email config:", err);
      else console.log("✓ Default email configuration inserted");
    }
  );
});

db.close((err) => {
  if (err) {
    console.error("Error closing database:", err.message);
    process.exit(1);
  }
  console.log("\n✅ Azure VM Deployment database initialization completed successfully!");
  console.log("You can now configure Azure credentials and settings via the admin panel.");
});
