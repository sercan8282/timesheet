/**
 * Azure VM Deployment Routes
 * Handles all endpoints for the Azure VM deployment automation tool
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const AzureService = require("../utils/azure-service");
const TerraformGenerator = require("../utils/terraform-generator");
const AzureDevOpsService = require("../utils/azure-devops-service");
const emailService = require("../utils/email");
const fs = require("fs").promises;
const path = require("path");

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/azure-deployment/config/environments
 * Get list of configured environments
 */
router.get("/config/environments", async (req, res) => {
  try {
    const environments = await db.all(
      `SELECT environment, subscription_id, created_at, updated_at 
       FROM azure_credentials 
       ORDER BY environment`
    );

    res.json({
      success: true,
      environments: environments.map(env => ({
        name: env.environment,
        subscriptionId: env.subscription_id,
        configured: true,
      })),
    });
  } catch (error) {
    console.error("Error fetching environments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch environments",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/server-types
 * Get list of server types with naming patterns
 */
router.get("/server-types", async (req, res) => {
  try {
    const serverTypes = await db.all(
      `SELECT * FROM vm_naming_patterns ORDER BY server_type`
    );

    res.json({
      success: true,
      serverTypes: serverTypes,
    });
  } catch (error) {
    console.error("Error fetching server types:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch server types",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/vm-sizes
 * Get available VM sizes for a subscription
 */
router.get("/vm-sizes", async (req, res) => {
  try {
    const { environment, location = "westeurope" } = req.query;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: "Environment is required",
      });
    }

    // Get Azure credentials for the environment
    const credentials = await db.get(
      `SELECT * FROM azure_credentials WHERE environment = ?`,
      [environment]
    );

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `No credentials found for environment: ${environment}`,
      });
    }

    // Initialize Azure service
    const azureService = new AzureService({
      tenantId: credentials.tenant_id,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      useManagedIdentity: process.env.USE_MANAGED_IDENTITY === "true",
    });

    // Get VM sizes
    const vmSizes = await azureService.listVmSizes(credentials.subscription_id, location);

    res.json({
      success: true,
      vmSizes: vmSizes,
      location: location,
    });
  } catch (error) {
    console.error("Error fetching VM sizes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch VM sizes",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/virtual-networks
 * Get virtual networks for a subscription
 */
router.get("/virtual-networks", async (req, res) => {
  try {
    const { environment } = req.query;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: "Environment is required",
      });
    }

    // Get Azure credentials
    const credentials = await db.get(
      `SELECT * FROM azure_credentials WHERE environment = ?`,
      [environment]
    );

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `No credentials found for environment: ${environment}`,
      });
    }

    // Initialize Azure service
    const azureService = new AzureService({
      tenantId: credentials.tenant_id,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      useManagedIdentity: process.env.USE_MANAGED_IDENTITY === "true",
    });

    // Get virtual networks
    const vnets = await azureService.listVirtualNetworks(credentials.subscription_id);

    res.json({
      success: true,
      virtualNetworks: vnets,
    });
  } catch (error) {
    console.error("Error fetching virtual networks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch virtual networks",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/resource-groups
 * Get resource groups for a subscription
 */
router.get("/resource-groups", async (req, res) => {
  try {
    const { environment } = req.query;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: "Environment is required",
      });
    }

    // Get Azure credentials
    const credentials = await db.get(
      `SELECT * FROM azure_credentials WHERE environment = ?`,
      [environment]
    );

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `No credentials found for environment: ${environment}`,
      });
    }

    // Initialize Azure service
    const azureService = new AzureService({
      tenantId: credentials.tenant_id,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      useManagedIdentity: process.env.USE_MANAGED_IDENTITY === "true",
    });

    // Get resource groups
    const resourceGroups = await azureService.listResourceGroups(credentials.subscription_id);

    res.json({
      success: true,
      resourceGroups: resourceGroups,
    });
  } catch (error) {
    console.error("Error fetching resource groups:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch resource groups",
      error: error.message,
    });
  }
});

/**
 * POST /api/azure-deployment/check-vm-name
 * Check if VM name is available and suggest next available name
 */
router.post("/check-vm-name", async (req, res) => {
  try {
    const { environment, serverType, customName } = req.body;

    if (!environment || !serverType) {
      return res.status(400).json({
        success: false,
        message: "Environment and serverType are required",
      });
    }

    // Get naming pattern
    const pattern = await db.get(
      `SELECT * FROM vm_naming_patterns WHERE server_type = ?`,
      [serverType]
    );

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: `No naming pattern found for server type: ${serverType}`,
      });
    }

    // Get Azure credentials
    const credentials = await db.get(
      `SELECT * FROM azure_credentials WHERE environment = ?`,
      [environment]
    );

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `No credentials found for environment: ${environment}`,
      });
    }

    // Initialize Azure service
    const azureService = new AzureService({
      tenantId: credentials.tenant_id,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      useManagedIdentity: process.env.USE_MANAGED_IDENTITY === "true",
    });

    // Find next available name
    const suggestedName = await azureService.findNextAvailableVmName(
      credentials.subscription_id,
      pattern.naming_pattern
    );

    // Check custom name if provided
    let customNameAvailable = null;
    if (customName) {
      customNameAvailable = await azureService.isVmNameAvailable(
        credentials.subscription_id,
        customName
      );
    }

    res.json({
      success: true,
      suggestedName: suggestedName,
      pattern: pattern.naming_pattern,
      customName: customName,
      customNameAvailable: customNameAvailable,
    });
  } catch (error) {
    console.error("Error checking VM name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check VM name",
      error: error.message,
    });
  }
});

/**
 * POST /api/azure-deployment/deploy
 * Create and deploy a new VM
 */
router.post("/deploy", async (req, res) => {
  try {
    const {
      environment,
      serverType,
      vmName,
      resourceGroup,
      location,
      vmSize,
      virtualNetwork,
      subnet,
      osType,
      osDiskSize,
      dataDisks, // Array of disk sizes
      adminUsername,
    } = req.body;

    // Validation
    if (!environment || !serverType || !vmName || !resourceGroup || !vmSize || !virtualNetwork) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Get configurations
    const [credentials, stateConfig, devopsConfig, pipelineConfig] = await Promise.all([
      db.get(`SELECT * FROM azure_credentials WHERE environment = ?`, [environment]),
      db.get(`SELECT * FROM terraform_state_config WHERE environment = ?`, [environment]),
      db.get(`SELECT * FROM azure_devops_config WHERE environment = ?`, [environment]),
      db.get(`SELECT * FROM pipeline_config WHERE environment = ? AND server_type = ?`, [
        environment,
        serverType,
      ]),
    ]);

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `No Azure credentials found for environment: ${environment}`,
      });
    }

    if (!devopsConfig) {
      return res.status(404).json({
        success: false,
        message: `No Azure DevOps configuration found for environment: ${environment}`,
      });
    }

    if (!pipelineConfig) {
      return res.status(404).json({
        success: false,
        message: `No pipeline configuration found for ${serverType} in ${environment}`,
      });
    }

    // Create deployment record
    const deployment = await db.run(
      `INSERT INTO vm_deployments (
        vm_name, environment, server_type, subscription_id, resource_group,
        vm_size, virtual_network, subnet, os_disk_size, data_disks_count,
        data_disk_sizes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        vmName,
        environment,
        serverType,
        credentials.subscription_id,
        resourceGroup,
        vmSize,
        virtualNetwork,
        subnet,
        osDiskSize || 128,
        dataDisks?.length || 0,
        JSON.stringify(dataDisks || []),
        req.user.id,
      ]
    );

    const deploymentId = deployment.lastID;

    // Generate Terraform code
    const terraformGenerator = new TerraformGenerator({
      stateConfigs: {
        [environment]: {
          resourceGroup: stateConfig?.resource_group,
          storageAccountName: stateConfig?.storage_account_name,
          containerName: stateConfig?.container_name,
        },
      },
      osType: osType || 'Linux',
    });

    const terraformCode = terraformGenerator.generateVmDeployment({
      vmName,
      resourceGroup,
      location: location || 'westeurope',
      vmSize,
      adminUsername: adminUsername || 'azureuser',
      virtualNetworkId: virtualNetwork,
      virtualNetworkName: virtualNetwork.split('/').pop(),
      subnetName: subnet || 'default',
      osType: osType || 'Linux',
      osDiskSize: osDiskSize || 128,
      dataDiskSizes: dataDisks || [],
      environment,
      tags: {
        ServerType: serverType,
        Environment: environment,
        DeploymentId: deploymentId.toString(),
      },
    });

    const terraformVars = terraformGenerator.generateTfvars({
      vmName,
      resourceGroup,
      location: location || 'westeurope',
      vmSize,
      adminUsername: adminUsername || 'azureuser',
      virtualNetworkName: virtualNetwork.split('/').pop(),
      subnetName: subnet || 'default',
    });

    const terraformReadme = terraformGenerator.generateReadme({
      vmName,
      resourceGroup,
      location: location || 'westeurope',
      vmSize,
      osType: osType || 'Linux',
      osDiskSize: osDiskSize || 128,
      dataDiskSizes: dataDisks || [],
      environment,
    });

    // Prepare files for Azure DevOps
    const terraformPath = pipelineConfig.terraform_path || 'terraform';
    const files = [
      {
        path: `/${terraformPath}/${vmName}/main.tf`,
        content: terraformCode,
      },
      {
        path: `/${terraformPath}/${vmName}/terraform.tfvars`,
        content: terraformVars,
      },
      {
        path: `/${terraformPath}/${vmName}/README.md`,
        content: terraformReadme,
      },
    ];

    // Initialize Azure DevOps service
    const devopsService = new AzureDevOpsService({
      organization: devopsConfig.organization,
      project: devopsConfig.project,
      repository: devopsConfig.repository,
      personalAccessToken: devopsConfig.personal_access_token,
    });

    // Create deployment workflow (branch + commit + pipeline trigger)
    const branchName = `deploy/${vmName}`;
    const workflowResult = await devopsService.createDeploymentWorkflow(
      vmName,
      files,
      pipelineConfig.pipeline_id,
      devopsConfig.default_branch || 'main'
    );

    if (!workflowResult.success) {
      // Update deployment status to failed
      await db.run(
        `UPDATE vm_deployments 
         SET status = 'failed', error_message = ? 
         WHERE id = ?`,
        [workflowResult.error, deploymentId]
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create deployment workflow",
        error: workflowResult.error,
      });
    }

    // Update deployment with branch and pipeline info
    await db.run(
      `UPDATE vm_deployments 
       SET status = 'deploying', branch_name = ?, pipeline_run_id = ?, terraform_generated_path = ? 
       WHERE id = ?`,
      [branchName, workflowResult.runId?.toString(), `${terraformPath}/${vmName}`, deploymentId]
    );

    // Send email notification (deployment started)
    try {
      const emailConfig = await db.get(`SELECT * FROM deployment_email_config WHERE id = 1`);
      if (emailConfig && emailConfig.enabled && emailConfig.notify_on_start) {
        const recipients = JSON.parse(emailConfig.recipient_emails);
        await emailService.sendDeploymentNotification({
          to: recipients,
          subject: `VM Deployment Started: ${vmName}`,
          vmName,
          environment,
          serverType,
          status: 'started',
          runUrl: workflowResult.runUrl,
        });
      }
    } catch (emailError) {
      console.error("Error sending email notification:", emailError);
      // Don't fail the deployment if email fails
    }

    res.json({
      success: true,
      message: "Deployment initiated successfully",
      deployment: {
        id: deploymentId,
        vmName,
        environment,
        branchName: branchName,
        runId: workflowResult.runId,
        runUrl: workflowResult.runUrl,
        terraformPath: `${terraformPath}/${vmName}`,
      },
    });
  } catch (error) {
    console.error("Error creating deployment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create deployment",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/deployments
 * Get deployment history
 */
router.get("/deployments", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const deployments = await db.all(
      `SELECT d.*, u.username as created_by_username 
       FROM vm_deployments d
       LEFT JOIN users u ON d.created_by = u.id
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    const total = await db.get(`SELECT COUNT(*) as count FROM vm_deployments`);

    res.json({
      success: true,
      deployments: deployments.map(d => ({
        ...d,
        data_disk_sizes: JSON.parse(d.data_disk_sizes || '[]'),
      })),
      pagination: {
        total: total.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Error fetching deployments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deployments",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/deployments/:id
 * Get deployment details
 */
router.get("/deployments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await db.get(
      `SELECT d.*, u.username as created_by_username 
       FROM vm_deployments d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = ?`,
      [id]
    );

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
    }

    res.json({
      success: true,
      deployment: {
        ...deployment,
        data_disk_sizes: JSON.parse(deployment.data_disk_sizes || '[]'),
      },
    });
  } catch (error) {
    console.error("Error fetching deployment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deployment",
      error: error.message,
    });
  }
});

/**
 * GET /api/azure-deployment/deployments/:id/status
 * Get pipeline status for a deployment
 */
router.get("/deployments/:id/status", async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await db.get(
      `SELECT * FROM vm_deployments WHERE id = ?`,
      [id]
    );

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
    }

    if (!deployment.pipeline_run_id) {
      return res.json({
        success: true,
        status: deployment.status,
        message: "No pipeline run ID available",
      });
    }

    // Get DevOps config
    const devopsConfig = await db.get(
      `SELECT * FROM azure_devops_config WHERE environment = ?`,
      [deployment.environment]
    );

    if (!devopsConfig) {
      return res.status(404).json({
        success: false,
        message: "Azure DevOps configuration not found",
      });
    }

    // Initialize Azure DevOps service
    const devopsService = new AzureDevOpsService({
      organization: devopsConfig.organization,
      project: devopsConfig.project,
      repository: devopsConfig.repository,
      personalAccessToken: devopsConfig.personal_access_token,
    });

    // Get pipeline status
    const pipelineStatus = await devopsService.getPipelineRunStatus(
      parseInt(deployment.pipeline_run_id)
    );

    // Update deployment status if completed
    if (pipelineStatus.state === 'completed') {
      const newStatus = pipelineStatus.result === 'succeeded' ? 'completed' : 'failed';
      await db.run(
        `UPDATE vm_deployments 
         SET status = ?, completed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [newStatus, id]
      );
    }

    res.json({
      success: true,
      deploymentStatus: deployment.status,
      pipelineStatus: pipelineStatus,
    });
  } catch (error) {
    console.error("Error fetching deployment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deployment status",
      error: error.message,
    });
  }
});

module.exports = router;
