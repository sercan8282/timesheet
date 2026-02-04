/**
 * Terraform Generator - Generates Terraform code for Azure VM deployments
 */

class TerraformGenerator {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Generate complete Terraform configuration for VM deployment
   */
  generateVmDeployment(options) {
    const {
      vmName,
      resourceGroup,
      location = "westeurope",
      vmSize,
      adminUsername = "azureuser",
      virtualNetworkId,
      virtualNetworkName,
      subnetName,
      osType = "Linux", // or "Windows"
      osDiskSize = 128,
      dataDiskSizes = [], // Array of disk sizes in GB
      tags = {},
      environment,
    } = options;

    const terraform = {
      provider: this.generateProvider(environment),
      backend: this.generateBackend(environment, vmName),
      variables: this.generateVariables(options),
      resources: this.generateResources(options),
    };

    return this.formatTerraform(terraform);
  }

  /**
   * Generate provider configuration
   */
  generateProvider(environment) {
    return `terraform {
  required_version = ">= 1.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    virtual_machine {
      delete_os_disk_on_deletion     = true
      graceful_shutdown              = false
      skip_shutdown_and_force_delete = false
    }
  }
  
  # Subscription will be inherited from environment or can be specified
  # subscription_id = var.subscription_id
}`;
  }

  /**
   * Generate backend configuration for state file
   */
  generateBackend(environment, vmName) {
    const stateConfig = this.config.stateConfigs?.[environment] || {};
    const stateFileName = `${vmName}-${Date.now()}.tfstate`;

    return `terraform {
  backend "azurerm" {
    resource_group_name  = "${stateConfig.resourceGroup || 'terraform-state-rg'}"
    storage_account_name = "${stateConfig.storageAccountName || 'tfstate' + environment}"
    container_name       = "${stateConfig.containerName || 'tfstate'}"
    key                  = "${stateFileName}"
  }
}`;
  }

  /**
   * Generate Terraform variables
   */
  generateVariables(options) {
    return `variable "resource_group_name" {
  description = "Resource group name"
  type        = string
  default     = "${options.resourceGroup}"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "${options.location || 'westeurope'}"
}

variable "vm_name" {
  description = "Virtual machine name"
  type        = string
  default     = "${options.vmName}"
}

variable "vm_size" {
  description = "Virtual machine size"
  type        = string
  default     = "${options.vmSize}"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "${options.adminUsername || 'azureuser'}"
}

variable "admin_password" {
  description = "Admin password for the VM"
  type        = string
  sensitive   = true
}

variable "vnet_name" {
  description = "Virtual network name"
  type        = string
  default     = "${options.virtualNetworkName}"
}

variable "subnet_name" {
  description = "Subnet name"
  type        = string
  default     = "${options.subnetName}"
}`;
  }

  /**
   * Generate all resource configurations
   */
  generateResources(options) {
    const resources = [];

    // Public IP
    resources.push(this.generatePublicIp(options));

    // Network Interface
    resources.push(this.generateNetworkInterface(options));

    // Virtual Machine
    resources.push(this.generateVirtualMachine(options));

    // Data Disks
    if (options.dataDiskSizes && options.dataDiskSizes.length > 0) {
      resources.push(this.generateDataDisks(options));
    }

    return resources.join('\n\n');
  }

  /**
   * Generate Public IP resource
   */
  generatePublicIp(options) {
    return `# Public IP Address
resource "azurerm_public_ip" "main" {
  name                = "\${var.vm_name}-pip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = ${this.formatTags(options.tags)}
}`;
  }

  /**
   * Generate Network Interface resource
   */
  generateNetworkInterface(options) {
    return `# Network Interface
data "azurerm_subnet" "main" {
  name                 = var.subnet_name
  virtual_network_name = var.vnet_name
  resource_group_name  = var.resource_group_name
}

resource "azurerm_network_interface" "main" {
  name                = "\${var.vm_name}-nic"
  location            = var.location
  resource_group_name = var.resource_group_name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = data.azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.main.id
  }

  tags = ${this.formatTags(options.tags)}
}`;
  }

  /**
   * Generate Virtual Machine resource
   */
  generateVirtualMachine(options) {
    const isWindows = options.osType === "Windows";
    const osProfile = isWindows ? this.generateWindowsProfile() : this.generateLinuxProfile();
    const imageReference = isWindows ? this.generateWindowsImage() : this.generateLinuxImage();

    return `# Virtual Machine
resource "azurerm_${isWindows ? 'windows' : 'linux'}_virtual_machine" "main" {
  name                = var.vm_name
  location            = var.location
  resource_group_name = var.resource_group_name
  size                = var.vm_size
  admin_username      = var.admin_username
  ${isWindows ? 'admin_password      = var.admin_password' : ''}
  
  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  ${osProfile}

  ${imageReference}

  os_disk {
    name                 = "\${var.vm_name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = ${options.osDiskSize || 128}
  }

  tags = ${this.formatTags(options.tags)}
}`;
  }

  /**
   * Generate Linux profile configuration
   */
  generateLinuxProfile() {
    return `disable_password_authentication = false
  
  admin_ssh_key {
    username   = var.admin_username
    public_key = file("~/.ssh/id_rsa.pub")
  }`;
  }

  /**
   * Generate Windows profile configuration
   */
  generateWindowsProfile() {
    return `# Windows-specific configuration
  enable_automatic_updates = true
  patch_mode              = "AutomaticByPlatform"`;
  }

  /**
   * Generate Linux image reference
   */
  generateLinuxImage() {
    return `source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }`;
  }

  /**
   * Generate Windows image reference
   */
  generateWindowsImage() {
    return `source_image_reference {
    publisher = "MicrosoftWindowsServer"
    offer     = "WindowsServer"
    sku       = "2022-datacenter-azure-edition"
    version   = "latest"
  }`;
  }

  /**
   * Generate data disks
   */
  generateDataDisks(options) {
    const disks = options.dataDiskSizes.map((size, index) => {
      const lun = index;
      return `# Data Disk ${lun + 1}
resource "azurerm_managed_disk" "data_disk_${lun}" {
  name                 = "\${var.vm_name}-datadisk-${lun}"
  location             = var.location
  resource_group_name  = var.resource_group_name
  storage_account_type = "Premium_LRS"
  create_option        = "Empty"
  disk_size_gb         = ${size}

  tags = ${this.formatTags(options.tags)}
}

resource "azurerm_virtual_machine_data_disk_attachment" "data_disk_${lun}" {
  managed_disk_id    = azurerm_managed_disk.data_disk_${lun}.id
  virtual_machine_id = azurerm_${options.osType === 'Windows' ? 'windows' : 'linux'}_virtual_machine.main.id
  lun                = ${lun}
  caching            = "ReadWrite"
}`;
    });

    return disks.join('\n\n');
  }

  /**
   * Generate outputs
   */
  generateOutputs(options) {
    return `# Outputs
output "vm_id" {
  description = "Virtual Machine ID"
  value       = azurerm_${options.osType === 'Windows' ? 'windows' : 'linux'}_virtual_machine.main.id
}

output "vm_name" {
  description = "Virtual Machine Name"
  value       = azurerm_${options.osType === 'Windows' ? 'windows' : 'linux'}_virtual_machine.main.name
}

output "public_ip_address" {
  description = "Public IP Address"
  value       = azurerm_public_ip.main.ip_address
}

output "private_ip_address" {
  description = "Private IP Address"
  value       = azurerm_network_interface.main.private_ip_address
}`;
  }

  /**
   * Format tags as Terraform map
   */
  formatTags(tags = {}) {
    const defaultTags = {
      Environment: tags.environment || 'Production',
      ManagedBy: 'Terraform',
      CreatedBy: 'Azure-VM-Deployment-Tool',
      CreatedAt: new Date().toISOString(),
    };

    const allTags = { ...defaultTags, ...tags };
    const tagEntries = Object.entries(allTags)
      .map(([key, value]) => `    ${key} = "${value}"`)
      .join('\n');

    return `{\n${tagEntries}\n  }`;
  }

  /**
   * Format complete Terraform configuration
   */
  formatTerraform(terraform) {
    return `# Generated by Azure VM Deployment Tool
# Generated at: ${new Date().toISOString()}

${terraform.provider}

${terraform.backend}

${terraform.variables}

${terraform.resources}

${this.generateOutputs({ osType: this.config.osType || 'Linux' })}
`;
  }

  /**
   * Generate terraform.tfvars file
   */
  generateTfvars(options) {
    return `# Terraform Variables File
# Generated at: ${new Date().toISOString()}

resource_group_name = "${options.resourceGroup}"
location            = "${options.location || 'westeurope'}"
vm_name             = "${options.vmName}"
vm_size             = "${options.vmSize}"
admin_username      = "${options.adminUsername || 'azureuser'}"
vnet_name           = "${options.virtualNetworkName}"
subnet_name         = "${options.subnetName}"

# Set admin_password via environment variable or command line:
# terraform apply -var="admin_password=YourSecurePassword"
`;
  }

  /**
   * Generate README for the deployment
   */
  generateReadme(options) {
    return `# Azure VM Deployment: ${options.vmName}

Generated by Azure VM Deployment Tool on ${new Date().toISOString()}

## VM Configuration

- **Name**: ${options.vmName}
- **Resource Group**: ${options.resourceGroup}
- **Location**: ${options.location || 'westeurope'}
- **VM Size**: ${options.vmSize}
- **OS Type**: ${options.osType || 'Linux'}
- **OS Disk Size**: ${options.osDiskSize || 128} GB
- **Data Disks**: ${options.dataDiskSizes?.length || 0}
- **Environment**: ${options.environment}

## Deployment Instructions

### Prerequisites

1. Install Terraform (>= 1.0)
2. Azure CLI installed and authenticated
3. Appropriate permissions on the Azure subscription

### Deploy

\`\`\`bash
# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -out=tfplan

# Apply the deployment
terraform apply tfplan

# Or apply directly with password
terraform apply -var="admin_password=YourSecurePassword"
\`\`\`

### Destroy

\`\`\`bash
terraform destroy -var="admin_password=YourSecurePassword"
\`\`\`

## State File

The Terraform state file is stored in Azure Storage:
- Resource Group: ${this.config.stateConfigs?.[options.environment]?.resourceGroup || 'terraform-state-rg'}
- Storage Account: ${this.config.stateConfigs?.[options.environment]?.storageAccountName || 'tfstate'}
- Container: ${this.config.stateConfigs?.[options.environment]?.containerName || 'tfstate'}

## Notes

- Remember to change the default admin password after deployment
- Review and adjust network security group rules as needed
- Consider enabling Azure Backup for the VM
- Review and adjust tags in main.tf as needed
`;
  }
}

module.exports = TerraformGenerator;
