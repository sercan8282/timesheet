/**
 * Azure VM Deployment Tool - Frontend JavaScript
 * Handles the UI for VM deployment automation
 */

// API helper functions
const azureDeploymentAPI = {
  // Get environments
  async getEnvironments() {
    const response = await fetch('/api/azure-deployment/config/environments', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Get server types
  async getServerTypes() {
    const response = await fetch('/api/azure-deployment/server-types', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Get VM sizes
  async getVmSizes(environment, location = 'westeurope') {
    const response = await fetch(`/api/azure-deployment/vm-sizes?environment=${environment}&location=${location}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Get virtual networks
  async getVirtualNetworks(environment) {
    const response = await fetch(`/api/azure-deployment/virtual-networks?environment=${environment}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Get resource groups
  async getResourceGroups(environment) {
    const response = await fetch(`/api/azure-deployment/resource-groups?environment=${environment}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Check VM name availability
  async checkVmName(environment, serverType, customName = null) {
    const response = await fetch('/api/azure-deployment/check-vm-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ environment, serverType, customName })
    });
    return response.json();
  },

  // Deploy VM
  async deployVm(deploymentData) {
    const response = await fetch('/api/azure-deployment/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(deploymentData)
    });
    return response.json();
  },

  // Get deployments
  async getDeployments(limit = 50, offset = 0) {
    const response = await fetch(`/api/azure-deployment/deployments?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  },

  // Get deployment status
  async getDeploymentStatus(deploymentId) {
    const response = await fetch(`/api/azure-deployment/deployments/${deploymentId}/status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  }
};

// Page state
let currentFormData = {
  environment: '',
  serverType: '',
  vmName: '',
  resourceGroup: '',
  location: 'westeurope',
  vmSize: '',
  virtualNetwork: '',
  subnet: '',
  osType: 'Linux',
  osDiskSize: 128,
  dataDisks: [],
  adminUsername: 'azureuser'
};

// Initialize the deployment form
async function initializeDeploymentForm() {
  try {
    // Load environments
    const envResult = await azureDeploymentAPI.getEnvironments();
    if (envResult.success) {
      const envSelect = document.getElementById('environment');
      envSelect.innerHTML = '<option value="">Selecteer omgeving...</option>';
      envResult.environments.forEach(env => {
        const option = document.createElement('option');
        option.value = env.name;
        option.textContent = env.name.charAt(0).toUpperCase() + env.name.slice(1);
        envSelect.appendChild(option);
      });
    }

    // Load server types
    const serverTypeResult = await azureDeploymentAPI.getServerTypes();
    if (serverTypeResult.success) {
      const serverTypeSelect = document.getElementById('serverType');
      serverTypeSelect.innerHTML = '<option value="">Selecteer server type...</option>';
      serverTypeResult.serverTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.server_type;
        option.textContent = type.description || type.server_type;
        option.dataset.pattern = type.naming_pattern;
        serverTypeSelect.appendChild(option);
      });
    }

    // Setup event listeners
    setupFormEventListeners();
    
  } catch (error) {
    console.error('Error initializing form:', error);
    showNotification('Fout bij laden van formulier', 'danger');
  }
}

// Setup event listeners for the form
function setupFormEventListeners() {
  // Environment change
  document.getElementById('environment')?.addEventListener('change', async (e) => {
    currentFormData.environment = e.target.value;
    if (e.target.value) {
      await loadEnvironmentData(e.target.value);
    }
  });

  // Server type change
  document.getElementById('serverType')?.addEventListener('change', async (e) => {
    currentFormData.serverType = e.target.value;
    if (e.target.value && currentFormData.environment) {
      await suggestVmName();
    }
  });

  // VM Size change - show details
  document.getElementById('vmSize')?.addEventListener('change', (e) => {
    currentFormData.vmSize = e.target.value;
    showVmSizeDetails(e.target.value);
  });

  // Virtual Network change - load subnets
  document.getElementById('virtualNetwork')?.addEventListener('change', (e) => {
    currentFormData.virtualNetwork = e.target.value;
    loadSubnets(e.target.value);
  });

  // Add data disk button
  document.getElementById('addDataDisk')?.addEventListener('click', addDataDisk);

  // Deploy button
  document.getElementById('deployButton')?.addEventListener('click', handleDeploy);
}

// Load environment-specific data
async function loadEnvironmentData(environment) {
  try {
    // Show loading
    showNotification('Laden van Azure resources...', 'info');

    // Load VM sizes
    const vmSizeResult = await azureDeploymentAPI.getVmSizes(environment);
    if (vmSizeResult.success) {
      populateVmSizes(vmSizeResult.vmSizes);
    }

    // Load virtual networks
    const vnetResult = await azureDeploymentAPI.getVirtualNetworks(environment);
    if (vnetResult.success) {
      populateVirtualNetworks(vnetResult.virtualNetworks);
    }

    // Load resource groups
    const rgResult = await azureDeploymentAPI.getResourceGroups(environment);
    if (rgResult.success) {
      populateResourceGroups(rgResult.resourceGroups);
    }

    showNotification('Azure resources geladen', 'success');
  } catch (error) {
    console.error('Error loading environment data:', error);
    showNotification('Fout bij laden van Azure resources', 'danger');
  }
}

// Populate VM sizes dropdown
function populateVmSizes(vmSizes) {
  const select = document.getElementById('vmSize');
  select.innerHTML = '<option value="">Selecteer VM grootte...</option>';
  
  vmSizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size.name;
    option.textContent = `${size.name} (${size.numberOfCores} vCPUs, ${(size.memoryInMB / 1024).toFixed(1)} GB RAM)`;
    option.dataset.cores = size.numberOfCores;
    option.dataset.memory = size.memoryInMB;
    option.dataset.maxDataDisks = size.maxDataDiskCount;
    option.dataset.osDiskSize = size.osDiskSizeInMB;
    select.appendChild(option);
  });
}

// Show VM size details
function showVmSizeDetails(sizeName) {
  const select = document.getElementById('vmSize');
  const selectedOption = select.querySelector(`option[value="${sizeName}"]`);
  
  if (selectedOption) {
    const detailsDiv = document.getElementById('vmSizeDetails');
    detailsDiv.innerHTML = `
      <div class="alert alert-info">
        <h6>VM Specificaties:</h6>
        <ul class="mb-0">
          <li><strong>vCPUs:</strong> ${selectedOption.dataset.cores}</li>
          <li><strong>RAM:</strong> ${(selectedOption.dataset.memory / 1024).toFixed(1)} GB</li>
          <li><strong>Max data schijven:</strong> ${selectedOption.dataset.maxDataDisks}</li>
          <li><strong>OS schijf grootte:</strong> ${(selectedOption.dataset.osDiskSize / 1024).toFixed(0)} GB (standaard)</li>
        </ul>
      </div>
    `;
    detailsDiv.style.display = 'block';
  }
}

// Populate virtual networks
function populateVirtualNetworks(vnets) {
  const select = document.getElementById('virtualNetwork');
  select.innerHTML = '<option value="">Selecteer virtueel netwerk...</option>';
  
  vnets.forEach(vnet => {
    const option = document.createElement('option');
    option.value = vnet.id;
    option.textContent = `${vnet.name} (${vnet.location}) - ${vnet.addressSpace.join(', ')}`;
    option.dataset.subnets = JSON.stringify(vnet.subnets);
    select.appendChild(option);
  });
}

// Load subnets for selected VNet
function loadSubnets(vnetId) {
  const vnetSelect = document.getElementById('virtualNetwork');
  const selectedOption = vnetSelect.querySelector(`option[value="${vnetId}"]`);
  
  if (selectedOption) {
    const subnets = JSON.parse(selectedOption.dataset.subnets || '[]');
    const subnetSelect = document.getElementById('subnet');
    subnetSelect.innerHTML = '<option value="">Selecteer subnet...</option>';
    
    subnets.forEach(subnet => {
      const option = document.createElement('option');
      option.value = subnet.name;
      option.textContent = `${subnet.name} (${subnet.addressPrefix})`;
      subnetSelect.appendChild(option);
    });
  }
}

// Populate resource groups
function populateResourceGroups(resourceGroups) {
  const select = document.getElementById('resourceGroup');
  select.innerHTML = '<option value="">Selecteer resource group...</option>';
  
  resourceGroups.forEach(rg => {
    const option = document.createElement('option');
    option.value = rg.name;
    option.textContent = `${rg.name} (${rg.location})`;
    select.appendChild(option);
  });
}

// Suggest VM name based on pattern
async function suggestVmName() {
  try {
    const result = await azureDeploymentAPI.checkVmName(
      currentFormData.environment,
      currentFormData.serverType
    );
    
    if (result.success) {
      document.getElementById('vmName').value = result.suggestedName;
      currentFormData.vmName = result.suggestedName;
      
      const suggestionDiv = document.getElementById('vmNameSuggestion');
      suggestionDiv.innerHTML = `
        <div class="alert alert-success">
          <small>Voorgestelde naam: <strong>${result.suggestedName}</strong> (patroon: ${result.pattern})</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error suggesting VM name:', error);
  }
}

// Add data disk
function addDataDisk() {
  const container = document.getElementById('dataDisksContainer');
  const diskIndex = currentFormData.dataDisks.length;
  
  const diskDiv = document.createElement('div');
  diskDiv.className = 'input-group mb-2';
  diskDiv.innerHTML = `
    <span class="input-group-text">Schijf ${diskIndex + 1}</span>
    <input type="number" class="form-control" placeholder="Grootte in GB" min="32" max="32767" value="128" data-disk-index="${diskIndex}">
    <button class="btn btn-outline-danger" type="button" onclick="removeDataDisk(${diskIndex})">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  container.appendChild(diskDiv);
  currentFormData.dataDisks.push(128);
  
  // Update data disk input listener
  const input = diskDiv.querySelector('input');
  input.addEventListener('change', (e) => {
    currentFormData.dataDisks[diskIndex] = parseInt(e.target.value) || 128;
  });
}

// Remove data disk
function removeDataDisk(index) {
  currentFormData.dataDisks.splice(index, 1);
  // Rebuild the data disks UI
  rebuildDataDisksUI();
}

// Rebuild data disks UI
function rebuildDataDisksUI() {
  const container = document.getElementById('dataDisksContainer');
  container.innerHTML = '';
  
  currentFormData.dataDisks.forEach((size, index) => {
    const diskDiv = document.createElement('div');
    diskDiv.className = 'input-group mb-2';
    diskDiv.innerHTML = `
      <span class="input-group-text">Schijf ${index + 1}</span>
      <input type="number" class="form-control" value="${size}" min="32" max="32767" data-disk-index="${index}">
      <button class="btn btn-outline-danger" type="button" onclick="removeDataDisk(${index})">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    container.appendChild(diskDiv);
    
    const input = diskDiv.querySelector('input');
    input.addEventListener('change', (e) => {
      currentFormData.dataDisks[index] = parseInt(e.target.value) || 128;
    });
  });
}

// Handle deployment
async function handleDeploy() {
  try {
    // Validate form
    if (!validateDeploymentForm()) {
      return;
    }

    // Collect form data
    const deploymentData = {
      environment: document.getElementById('environment').value,
      serverType: document.getElementById('serverType').value,
      vmName: document.getElementById('vmName').value,
      resourceGroup: document.getElementById('resourceGroup').value,
      location: document.getElementById('location')?.value || 'westeurope',
      vmSize: document.getElementById('vmSize').value,
      virtualNetwork: document.getElementById('virtualNetwork').value,
      subnet: document.getElementById('subnet').value,
      osType: document.getElementById('osType').value,
      osDiskSize: parseInt(document.getElementById('osDiskSize').value) || 128,
      dataDisks: currentFormData.dataDisks,
      adminUsername: document.getElementById('adminUsername')?.value || 'azureuser'
    };

    // Show confirmation
    if (!confirm(`Weet u zeker dat u VM "${deploymentData.vmName}" wilt deployen naar ${deploymentData.environment}?`)) {
      return;
    }

    // Disable button
    const deployButton = document.getElementById('deployButton');
    deployButton.disabled = true;
    deployButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Bezig met deployen...';

    // Deploy
    const result = await azureDeploymentAPI.deployVm(deploymentData);

    if (result.success) {
      showNotification('VM deployment gestart!', 'success');
      
      // Show deployment details
      showDeploymentResult(result.deployment);
      
      // Reset form
      resetDeploymentForm();
    } else {
      showNotification(`Deployment mislukt: ${result.message}`, 'danger');
    }

  } catch (error) {
    console.error('Error deploying VM:', error);
    showNotification('Fout bij deployen van VM', 'danger');
  } finally {
    // Re-enable button
    const deployButton = document.getElementById('deployButton');
    deployButton.disabled = false;
    deployButton.innerHTML = '<i class="fas fa-rocket me-2"></i>Deploy VM';
  }
}

// Validate deployment form
function validateDeploymentForm() {
  const requiredFields = [
    'environment', 'serverType', 'vmName', 'resourceGroup',
    'vmSize', 'virtualNetwork', 'subnet'
  ];

  for (const field of requiredFields) {
    const value = document.getElementById(field)?.value;
    if (!value) {
      showNotification(`Veld "${field}" is verplicht`, 'warning');
      document.getElementById(field)?.focus();
      return false;
    }
  }

  return true;
}

// Show deployment result
function showDeploymentResult(deployment) {
  const resultDiv = document.getElementById('deploymentResult');
  resultDiv.innerHTML = `
    <div class="alert alert-success">
      <h5><i class="fas fa-check-circle me-2"></i>Deployment Gestart!</h5>
      <hr>
      <p><strong>VM Name:</strong> ${deployment.vmName}</p>
      <p><strong>Environment:</strong> ${deployment.environment}</p>
      <p><strong>Branch:</strong> ${deployment.branchName}</p>
      <p><strong>Pipeline Run:</strong> <a href="${deployment.runUrl}" target="_blank">${deployment.runId}</a></p>
      <p><strong>Terraform Path:</strong> ${deployment.terraformPath}</p>
      <hr>
      <p class="mb-0">
        <a href="#" onclick="viewDeploymentStatus(${deployment.id}); return false;" class="btn btn-sm btn-primary">
          <i class="fas fa-eye me-1"></i>Bekijk Status
        </a>
      </p>
    </div>
  `;
  resultDiv.style.display = 'block';
}

// Reset deployment form
function resetDeploymentForm() {
  document.getElementById('deploymentForm')?.reset();
  currentFormData = {
    environment: '',
    serverType: '',
    vmName: '',
    resourceGroup: '',
    location: 'westeurope',
    vmSize: '',
    virtualNetwork: '',
    subnet: '',
    osType: 'Linux',
    osDiskSize: 128,
    dataDisks: [],
    adminUsername: 'azureuser'
  };
  document.getElementById('vmSizeDetails').style.display = 'none';
  document.getElementById('dataDisksContainer').innerHTML = '';
}

// View deployment status
async function viewDeploymentStatus(deploymentId) {
  try {
    const result = await azureDeploymentAPI.getDeploymentStatus(deploymentId);
    
    if (result.success) {
      // Show status modal or update UI
      alert(`Deployment Status: ${result.deploymentStatus}\nPipeline: ${result.pipelineStatus?.state || 'Unknown'}`);
    }
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    showNotification('Fout bij ophalen van deployment status', 'danger');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Use existing notification system or create a simple one
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  const container = document.getElementById('notificationContainer') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Load deployment history
async function loadDeploymentHistory() {
  try {
    const result = await azureDeploymentAPI.getDeployments();
    
    if (result.success) {
      displayDeploymentHistory(result.deployments);
    }
  } catch (error) {
    console.error('Error loading deployment history:', error);
    showNotification('Fout bij laden van deployment geschiedenis', 'danger');
  }
}

// Display deployment history
function displayDeploymentHistory(deployments) {
  const tbody = document.getElementById('deploymentHistoryTable');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  deployments.forEach(deployment => {
    const row = document.createElement('tr');
    
    const statusBadge = {
      'pending': 'secondary',
      'deploying': 'primary',
      'completed': 'success',
      'failed': 'danger'
    }[deployment.status] || 'secondary';
    
    row.innerHTML = `
      <td>${deployment.vm_name}</td>
      <td>${deployment.environment}</td>
      <td>${deployment.server_type}</td>
      <td>${deployment.vm_size}</td>
      <td><span class="badge bg-${statusBadge}">${deployment.status}</span></td>
      <td>${new Date(deployment.created_at).toLocaleString('nl-NL')}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="viewDeploymentStatus(${deployment.id})">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('deploymentForm')) {
    initializeDeploymentForm();
  }
  
  if (document.getElementById('deploymentHistoryTable')) {
    loadDeploymentHistory();
    // Refresh every 30 seconds
    setInterval(loadDeploymentHistory, 30000);
  }
});
