/**
 * Azure Deployment Configuration Routes (Admin Only)
 * Backend configuration GUI for Azure VM deployment tool
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authMiddleware } = require("../middleware/auth");
const AzureService = require("../utils/azure-service");
const AzureDevOpsService = require("../utils/azure-devops-service");

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: "Admin privileges required",
    });
  }
  next();
});

/**
 * Azure Credentials Management
 */

// GET all Azure credentials
router.get("/credentials", async (req, res) => {
  try {
    const credentials = await db.all(
      `SELECT id, environment, tenant_id, client_id, subscription_id, created_at, updated_at 
       FROM azure_credentials 
       ORDER BY environment`
    );

    res.json({
      success: true,
      credentials: credentials,
    });
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch credentials",
      error: error.message,
    });
  }
});

// POST/PUT Azure credentials
router.post("/credentials", async (req, res) => {
  try {
    const { environment, tenantId, clientId, clientSecret, subscriptionId } = req.body;

    if (!environment || !tenantId || !clientId || !clientSecret || !subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if exists
    const existing = await db.get(
      `SELECT id FROM azure_credentials WHERE environment = ?`,
      [environment]
    );

    if (existing) {
      // Update
      await db.run(
        `UPDATE azure_credentials 
         SET tenant_id = ?, client_id = ?, client_secret = ?, subscription_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE environment = ?`,
        [tenantId, clientId, clientSecret, subscriptionId, environment]
      );
    } else {
      // Insert
      await db.run(
        `INSERT INTO azure_credentials (environment, tenant_id, client_id, client_secret, subscription_id) 
         VALUES (?, ?, ?, ?, ?)`,
        [environment, tenantId, clientId, clientSecret, subscriptionId]
      );
    }

    res.json({
      success: true,
      message: `Credentials ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save credentials",
      error: error.message,
    });
  }
});

// DELETE Azure credentials
router.delete("/credentials/:environment", async (req, res) => {
  try {
    const { environment } = req.params;

    await db.run(`DELETE FROM azure_credentials WHERE environment = ?`, [environment]);

    res.json({
      success: true,
      message: "Credentials deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete credentials",
      error: error.message,
    });
  }
});

// POST test Azure connection
router.post("/credentials/test", async (req, res) => {
  try {
    const { environment, tenantId, clientId, clientSecret, subscriptionId } = req.body;

    if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "All credential fields are required for testing",
      });
    }

    const azureService = new AzureService({
      tenantId,
      clientId,
      clientSecret,
      useManagedIdentity: false,
    });

    const result = await azureService.testConnection(subscriptionId);

    res.json(result);
  } catch (error) {
    console.error("Error testing connection:", error);
    res.status(500).json({
      success: false,
      message: "Connection test failed",
      error: error.message,
    });
  }
});

/**
 * Terraform State Configuration
 */

// GET state configurations
router.get("/state-config", async (req, res) => {
  try {
    const configs = await db.all(
      `SELECT * FROM terraform_state_config ORDER BY environment`
    );

    res.json({
      success: true,
      configs: configs.map(c => ({
        ...c,
        access_key: c.access_key ? '***' : null, // Mask the access key
      })),
    });
  } catch (error) {
    console.error("Error fetching state config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch state configuration",
      error: error.message,
    });
  }
});

// POST/PUT state configuration
router.post("/state-config", async (req, res) => {
  try {
    const { environment, storageAccountName, containerName, resourceGroup, accessKey } = req.body;

    if (!environment || !storageAccountName || !containerName || !resourceGroup) {
      return res.status(400).json({
        success: false,
        message: "Environment, storage account, container, and resource group are required",
      });
    }

    const existing = await db.get(
      `SELECT id FROM terraform_state_config WHERE environment = ?`,
      [environment]
    );

    if (existing) {
      // Update (only update access key if provided)
      if (accessKey) {
        await db.run(
          `UPDATE terraform_state_config 
           SET storage_account_name = ?, container_name = ?, resource_group = ?, access_key = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE environment = ?`,
          [storageAccountName, containerName, resourceGroup, accessKey, environment]
        );
      } else {
        await db.run(
          `UPDATE terraform_state_config 
           SET storage_account_name = ?, container_name = ?, resource_group = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE environment = ?`,
          [storageAccountName, containerName, resourceGroup, environment]
        );
      }
    } else {
      // Insert
      await db.run(
        `INSERT INTO terraform_state_config (environment, storage_account_name, container_name, resource_group, access_key) 
         VALUES (?, ?, ?, ?, ?)`,
        [environment, storageAccountName, containerName, resourceGroup, accessKey || null]
      );
    }

    res.json({
      success: true,
      message: `State configuration ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving state config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save state configuration",
      error: error.message,
    });
  }
});

/**
 * VM Naming Patterns
 */

// GET naming patterns
router.get("/naming-patterns", async (req, res) => {
  try {
    const patterns = await db.all(
      `SELECT * FROM vm_naming_patterns ORDER BY server_type`
    );

    res.json({
      success: true,
      patterns: patterns,
    });
  } catch (error) {
    console.error("Error fetching naming patterns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch naming patterns",
      error: error.message,
    });
  }
});

// POST/PUT naming pattern
router.post("/naming-patterns", async (req, res) => {
  try {
    const { serverType, namingPattern, description } = req.body;

    if (!serverType || !namingPattern) {
      return res.status(400).json({
        success: false,
        message: "Server type and naming pattern are required",
      });
    }

    const existing = await db.get(
      `SELECT id FROM vm_naming_patterns WHERE server_type = ?`,
      [serverType]
    );

    if (existing) {
      await db.run(
        `UPDATE vm_naming_patterns 
         SET naming_pattern = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE server_type = ?`,
        [namingPattern, description, serverType]
      );
    } else {
      await db.run(
        `INSERT INTO vm_naming_patterns (server_type, naming_pattern, description) 
         VALUES (?, ?, ?)`,
        [serverType, namingPattern, description]
      );
    }

    res.json({
      success: true,
      message: `Naming pattern ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving naming pattern:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save naming pattern",
      error: error.message,
    });
  }
});

// DELETE naming pattern
router.delete("/naming-patterns/:serverType", async (req, res) => {
  try {
    const { serverType } = req.params;

    await db.run(`DELETE FROM vm_naming_patterns WHERE server_type = ?`, [serverType]);

    res.json({
      success: true,
      message: "Naming pattern deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting naming pattern:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete naming pattern",
      error: error.message,
    });
  }
});

/**
 * Azure DevOps Configuration
 */

// GET DevOps configurations
router.get("/devops-config", async (req, res) => {
  try {
    const configs = await db.all(
      `SELECT id, environment, organization, project, repository, default_branch, created_at, updated_at 
       FROM azure_devops_config 
       ORDER BY environment`
    );

    res.json({
      success: true,
      configs: configs,
    });
  } catch (error) {
    console.error("Error fetching DevOps config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch DevOps configuration",
      error: error.message,
    });
  }
});

// POST/PUT DevOps configuration
router.post("/devops-config", async (req, res) => {
  try {
    const { environment, organization, project, repository, personalAccessToken, defaultBranch } = req.body;

    if (!environment || !organization || !project || !repository || !personalAccessToken) {
      return res.status(400).json({
        success: false,
        message: "All fields except default branch are required",
      });
    }

    const existing = await db.get(
      `SELECT id FROM azure_devops_config WHERE environment = ?`,
      [environment]
    );

    if (existing) {
      await db.run(
        `UPDATE azure_devops_config 
         SET organization = ?, project = ?, repository = ?, personal_access_token = ?, default_branch = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE environment = ?`,
        [organization, project, repository, personalAccessToken, defaultBranch || 'main', environment]
      );
    } else {
      await db.run(
        `INSERT INTO azure_devops_config (environment, organization, project, repository, personal_access_token, default_branch) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [environment, organization, project, repository, personalAccessToken, defaultBranch || 'main']
      );
    }

    res.json({
      success: true,
      message: `DevOps configuration ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving DevOps config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save DevOps configuration",
      error: error.message,
    });
  }
});

// POST test DevOps connection
router.post("/devops-config/test", async (req, res) => {
  try {
    const { organization, project, personalAccessToken } = req.body;

    if (!organization || !project || !personalAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Organization, project, and PAT are required",
      });
    }

    const devopsService = new AzureDevOpsService({
      organization,
      project,
      repository: 'test', // Not needed for connection test
      personalAccessToken,
    });

    const result = await devopsService.testConnection();

    res.json(result);
  } catch (error) {
    console.error("Error testing DevOps connection:", error);
    res.status(500).json({
      success: false,
      message: "DevOps connection test failed",
      error: error.message,
    });
  }
});

/**
 * Pipeline Configuration
 */

// GET pipeline configurations
router.get("/pipeline-config", async (req, res) => {
  try {
    const configs = await db.all(
      `SELECT * FROM pipeline_config ORDER BY environment, server_type`
    );

    res.json({
      success: true,
      configs: configs,
    });
  } catch (error) {
    console.error("Error fetching pipeline config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pipeline configuration",
      error: error.message,
    });
  }
});

// POST/PUT pipeline configuration
router.post("/pipeline-config", async (req, res) => {
  try {
    const { environment, serverType, pipelineName, pipelineId, terraformPath } = req.body;

    if (!environment || !serverType || !pipelineName || !pipelineId) {
      return res.status(400).json({
        success: false,
        message: "Environment, server type, pipeline name, and pipeline ID are required",
      });
    }

    const existing = await db.get(
      `SELECT id FROM pipeline_config WHERE environment = ? AND server_type = ?`,
      [environment, serverType]
    );

    if (existing) {
      await db.run(
        `UPDATE pipeline_config 
         SET pipeline_name = ?, pipeline_id = ?, terraform_path = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE environment = ? AND server_type = ?`,
        [pipelineName, pipelineId, terraformPath || 'terraform', environment, serverType]
      );
    } else {
      await db.run(
        `INSERT INTO pipeline_config (environment, server_type, pipeline_name, pipeline_id, terraform_path) 
         VALUES (?, ?, ?, ?, ?)`,
        [environment, serverType, pipelineName, pipelineId, terraformPath || 'terraform']
      );
    }

    res.json({
      success: true,
      message: `Pipeline configuration ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving pipeline config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save pipeline configuration",
      error: error.message,
    });
  }
});

// DELETE pipeline configuration
router.delete("/pipeline-config/:environment/:serverType", async (req, res) => {
  try {
    const { environment, serverType } = req.params;

    await db.run(
      `DELETE FROM pipeline_config WHERE environment = ? AND server_type = ?`,
      [environment, serverType]
    );

    res.json({
      success: true,
      message: "Pipeline configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting pipeline config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete pipeline configuration",
      error: error.message,
    });
  }
});

/**
 * Email Configuration
 */

// GET email configuration
router.get("/email-config", async (req, res) => {
  try {
    const config = await db.get(`SELECT * FROM deployment_email_config WHERE id = 1`);

    res.json({
      success: true,
      config: config ? {
        ...config,
        recipient_emails: JSON.parse(config.recipient_emails),
      } : null,
    });
  } catch (error) {
    console.error("Error fetching email config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch email configuration",
      error: error.message,
    });
  }
});

// POST/PUT email configuration
router.post("/email-config", async (req, res) => {
  try {
    const { enabled, notifyOnStart, notifyOnCompletion, notifyOnFailure, recipientEmails } = req.body;

    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one recipient email is required",
      });
    }

    const existing = await db.get(`SELECT id FROM deployment_email_config WHERE id = 1`);

    if (existing) {
      await db.run(
        `UPDATE deployment_email_config 
         SET enabled = ?, notify_on_start = ?, notify_on_completion = ?, notify_on_failure = ?, recipient_emails = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = 1`,
        [
          enabled ? 1 : 0,
          notifyOnStart ? 1 : 0,
          notifyOnCompletion ? 1 : 0,
          notifyOnFailure ? 1 : 0,
          JSON.stringify(recipientEmails),
        ]
      );
    } else {
      await db.run(
        `INSERT INTO deployment_email_config (id, enabled, notify_on_start, notify_on_completion, notify_on_failure, recipient_emails) 
         VALUES (1, ?, ?, ?, ?, ?)`,
        [
          enabled ? 1 : 0,
          notifyOnStart ? 1 : 0,
          notifyOnCompletion ? 1 : 0,
          notifyOnFailure ? 1 : 0,
          JSON.stringify(recipientEmails),
        ]
      );
    }

    res.json({
      success: true,
      message: `Email configuration ${existing ? 'updated' : 'created'} successfully`,
    });
  } catch (error) {
    console.error("Error saving email config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save email configuration",
      error: error.message,
    });
  }
});

module.exports = router;
