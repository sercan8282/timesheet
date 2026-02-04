/**
 * Azure Service - Handles all Azure API interactions
 * Uses Azure SDK for Node.js and Managed Identity support
 */

const { DefaultAzureCredential, ClientSecretCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { NetworkManagementClient } = require("@azure/arm-network");
const { ResourceManagementClient } = require("@azure/arm-resources");
const { SubscriptionClient } = require("@azure/arm-subscriptions");
const { BlobServiceClient } = require("@azure/storage-blob");

class AzureService {
  constructor(config = {}) {
    this.config = config;
    this.credential = null;
    this.initializeCredential();
  }

  /**
   * Initialize Azure credentials
   * Uses Managed Identity in production, Service Principal in development
   */
  initializeCredential() {
    if (this.config.useManagedIdentity) {
      // Use Managed Identity when running in Azure
      this.credential = new DefaultAzureCredential();
      console.log("Using Azure Managed Identity for authentication");
    } else if (this.config.tenantId && this.config.clientId && this.config.clientSecret) {
      // Use Service Principal credentials
      this.credential = new ClientSecretCredential(
        this.config.tenantId,
        this.config.clientId,
        this.config.clientSecret
      );
      console.log("Using Service Principal for authentication");
    } else {
      console.warn("No Azure credentials configured");
    }
  }

  /**
   * Get compute client for a specific subscription
   */
  getComputeClient(subscriptionId) {
    if (!this.credential) {
      throw new Error("Azure credentials not configured");
    }
    return new ComputeManagementClient(this.credential, subscriptionId);
  }

  /**
   * Get network client for a specific subscription
   */
  getNetworkClient(subscriptionId) {
    if (!this.credential) {
      throw new Error("Azure credentials not configured");
    }
    return new NetworkManagementClient(this.credential, subscriptionId);
  }

  /**
   * Get resource client for a specific subscription
   */
  getResourceClient(subscriptionId) {
    if (!this.credential) {
      throw new Error("Azure credentials not configured");
    }
    return new ResourceManagementClient(this.credential, subscriptionId);
  }

  /**
   * Get subscription client
   */
  getSubscriptionClient() {
    if (!this.credential) {
      throw new Error("Azure credentials not configured");
    }
    return new SubscriptionClient(this.credential);
  }

  /**
   * List all available VM sizes in a location
   */
  async listVmSizes(subscriptionId, location = "westeurope") {
    try {
      const computeClient = this.getComputeClient(subscriptionId);
      const vmSizes = [];
      
      for await (const size of computeClient.virtualMachineSizes.list(location)) {
        vmSizes.push({
          name: size.name,
          numberOfCores: size.numberOfCores,
          memoryInMB: size.memoryInMB,
          osDiskSizeInMB: size.osDiskSizeInMB,
          maxDataDiskCount: size.maxDataDiskCount,
          resourceDiskSizeInMB: size.resourceDiskSizeInMB,
        });
      }
      
      return vmSizes;
    } catch (error) {
      console.error("Error listing VM sizes:", error);
      throw new Error(`Failed to list VM sizes: ${error.message}`);
    }
  }

  /**
   * List all virtual networks in a subscription
   */
  async listVirtualNetworks(subscriptionId) {
    try {
      const networkClient = this.getNetworkClient(subscriptionId);
      const vnets = [];
      
      for await (const vnet of networkClient.virtualNetworks.listAll()) {
        vnets.push({
          id: vnet.id,
          name: vnet.name,
          resourceGroup: this.extractResourceGroup(vnet.id),
          location: vnet.location,
          addressSpace: vnet.addressSpace?.addressPrefixes || [],
          subnets: vnet.subnets?.map(subnet => ({
            name: subnet.name,
            addressPrefix: subnet.addressPrefix,
          })) || [],
        });
      }
      
      return vnets;
    } catch (error) {
      console.error("Error listing virtual networks:", error);
      throw new Error(`Failed to list virtual networks: ${error.message}`);
    }
  }

  /**
   * List all resource groups in a subscription
   */
  async listResourceGroups(subscriptionId) {
    try {
      const resourceClient = this.getResourceClient(subscriptionId);
      const resourceGroups = [];
      
      for await (const rg of resourceClient.resourceGroups.list()) {
        resourceGroups.push({
          id: rg.id,
          name: rg.name,
          location: rg.location,
          tags: rg.tags || {},
        });
      }
      
      return resourceGroups;
    } catch (error) {
      console.error("Error listing resource groups:", error);
      throw new Error(`Failed to list resource groups: ${error.message}`);
    }
  }

  /**
   * List all virtual machines in a subscription (for name checking)
   */
  async listVirtualMachines(subscriptionId) {
    try {
      const computeClient = this.getComputeClient(subscriptionId);
      const vms = [];
      
      for await (const vm of computeClient.virtualMachines.listAll()) {
        vms.push({
          id: vm.id,
          name: vm.name,
          resourceGroup: this.extractResourceGroup(vm.id),
          location: vm.location,
          vmSize: vm.hardwareProfile?.vmSize,
        });
      }
      
      return vms;
    } catch (error) {
      console.error("Error listing virtual machines:", error);
      throw new Error(`Failed to list virtual machines: ${error.message}`);
    }
  }

  /**
   * Find next available VM name based on pattern
   */
  async findNextAvailableVmName(subscriptionId, pattern) {
    try {
      const vms = await this.listVirtualMachines(subscriptionId);
      const existingNames = vms
        .map(vm => vm.name.toLowerCase())
        .filter(name => name.startsWith(pattern.toLowerCase()));
      
      // Extract numbers from existing names
      const existingNumbers = existingNames
        .map(name => {
          const match = name.match(new RegExp(`${pattern}(\\d+)`, 'i'));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num))
        .sort((a, b) => a - b);
      
      // Find the next available number
      let nextNumber = 1;
      for (const num of existingNumbers) {
        if (num === nextNumber) {
          nextNumber++;
        } else if (num > nextNumber) {
          break;
        }
      }
      
      // Format with leading zeros (e.g., nlvmapp01, nlvmapp02)
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      return `${pattern}${formattedNumber}`;
    } catch (error) {
      console.error("Error finding next available VM name:", error);
      throw new Error(`Failed to find next available VM name: ${error.message}`);
    }
  }

  /**
   * Check if a VM name is available
   */
  async isVmNameAvailable(subscriptionId, vmName) {
    try {
      const vms = await this.listVirtualMachines(subscriptionId);
      return !vms.some(vm => vm.name.toLowerCase() === vmName.toLowerCase());
    } catch (error) {
      console.error("Error checking VM name availability:", error);
      throw new Error(`Failed to check VM name availability: ${error.message}`);
    }
  }

  /**
   * Upload Terraform state file to Azure Storage
   */
  async uploadStateFile(storageAccountName, containerName, accessKey, fileName, content) {
    try {
      const blobServiceClient = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        new StorageSharedKeyCredential(storageAccountName, accessKey)
      );
      
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      await blockBlobClient.upload(content, content.length);
      
      return {
        success: true,
        url: blockBlobClient.url,
      };
    } catch (error) {
      console.error("Error uploading state file:", error);
      throw new Error(`Failed to upload state file: ${error.message}`);
    }
  }

  /**
   * Extract resource group name from Azure resource ID
   */
  extractResourceGroup(resourceId) {
    if (!resourceId) return null;
    const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Test Azure connection
   */
  async testConnection(subscriptionId) {
    try {
      const subscriptionClient = this.getSubscriptionClient();
      const subscription = await subscriptionClient.subscriptions.get(subscriptionId);
      
      return {
        success: true,
        subscriptionName: subscription.displayName,
        subscriptionId: subscription.subscriptionId,
        state: subscription.state,
      };
    } catch (error) {
      console.error("Error testing Azure connection:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = AzureService;
