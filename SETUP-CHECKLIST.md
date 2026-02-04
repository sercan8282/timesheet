# Azure VM Deployment Tool - Setup Checklist

Volg deze stappen om de Azure VM deployment tool volledig te configureren en te gebruiken.

## ☐ Fase 1: Voorbereiding (15 min)

### Azure Resources Aanmaken

#### 1. Service Principal voor Productie
```bash
az ad sp create-for-rbac \
  --name "vm-deployment-production" \
  --role Contributor \
  --scopes /subscriptions/{prod-subscription-id}
```

**Noteer:**
- ☐ Tenant ID
- ☐ Client ID (appId)
- ☐ Client Secret (password)
- ☐ Subscription ID

#### 2. Service Principal voor Acceptatie
```bash
az ad sp create-for-rbac \
  --name "vm-deployment-acceptance" \
  --role Contributor \
  --scopes /subscriptions/{acc-subscription-id}
```

**Noteer:**
- ☐ Tenant ID
- ☐ Client ID (appId)
- ☐ Client Secret (password)
- ☐ Subscription ID

#### 3. Storage Account voor Terraform State (Productie)
```bash
# Create resource group
az group create \
  --name rg-terraform-state-prod \
  --location westeurope

# Create storage account
az storage account create \
  --name tfstateprod12345 \
  --resource-group rg-terraform-state-prod \
  --location westeurope \
  --sku Standard_LRS \
  --encryption-services blob

# Create container
az storage container create \
  --name tfstate \
  --account-name tfstateprod12345
```

**Noteer:**
- ☐ Storage Account Name
- ☐ Resource Group Name
- ☐ Container Name
- ☐ Access Key (via Portal of `az storage account keys list`)

#### 4. Storage Account voor Terraform State (Acceptatie)
```bash
az group create \
  --name rg-terraform-state-acc \
  --location westeurope

az storage account create \
  --name tfstateacc12345 \
  --resource-group rg-terraform-state-acc \
  --location westeurope \
  --sku Standard_LRS

az storage container create \
  --name tfstate \
  --account-name tfstateacc12345
```

**Noteer:**
- ☐ Storage Account Name
- ☐ Resource Group Name
- ☐ Container Name
- ☐ Access Key

#### 5. Azure DevOps Personal Access Token
1. ☐ Ga naar https://dev.azure.com
2. ☐ Klik op User Settings → Personal access tokens
3. ☐ New Token:
   - Name: "VM Deployment Tool"
   - Organization: All accessible organizations
   - Scopes:
     - ☐ Code: Read & Write
     - ☐ Build: Read & Execute
4. ☐ **Noteer token value** (verdwijnt na sluiten!)

**Noteer ook:**
- ☐ Organization Name
- ☐ Project Name
- ☐ Repository Name

---

## ☐ Fase 2: Installatie (10 min)

### Tool Installeren

```bash
# Clone repository (als nog niet gedaan)
cd /path/to/timesheet

# Install dependencies
npm install

# Initialize Azure deployment database
node scripts/init-azure-deployment-db.js

# Of gebruik installatie script
chmod +x scripts/install-azure-deployment.sh
./scripts/install-azure-deployment.sh
```

**Checklist:**
- ☐ Dependencies geïnstalleerd zonder errors
- ☐ Database tables aangemaakt
- ☐ Default data inserted (VM naming patterns)
- ☐ Server start zonder errors

### Verify Installation

```bash
# Start server
npm start

# Check logs voor:
# ✓ Azure Deployment routes loaded
# ✓ Azure Deployment Config routes loaded
```

---

## ☐ Fase 3: Configuratie via GUI (20 min)

### Login als Admin
- ☐ Open browser: http://localhost:3000
- ☐ Login met admin credentials
- ☐ Ga naar Admin panel

### 1. Azure Credentials Configureren

#### Productie Environment
- ☐ Ga naar "Azure Deployment Config" → "Azure Credentials"
- ☐ Click "Add Credentials"
- ☐ Fill in:
  - Environment: `production`
  - Tenant ID: {van stap 1}
  - Client ID: {van stap 1}
  - Client Secret: {van stap 1}
  - Subscription ID: {van stap 1}
- ☐ Click "Test Connection"
- ☐ Verify: "Connection successful"
- ☐ Click "Save"

#### Acceptatie Environment
- ☐ Herhaal voor environment: `acceptance`
- ☐ Test connection
- ☐ Save

### 2. Terraform State Storage Configureren

#### Productie
- ☐ Ga naar "State Configuration" tab
- ☐ Click "Add Configuration"
- ☐ Fill in:
  - Environment: `production`
  - Storage Account Name: {van stap 3}
  - Container Name: `tfstate`
  - Resource Group: {van stap 3}
  - Access Key: {van stap 3}
- ☐ Click "Save"

#### Acceptatie
- ☐ Herhaal voor `acceptance`
- ☐ Save

### 3. VM Naming Patterns (Check & Aanpassen)

- ☐ Ga naar "Naming Patterns" tab
- ☐ Verify default patterns:
  - ☐ application → nlvmapp
  - ☐ sql → nlvmdb
  - ☐ web → nlvmweb
  - ☐ file → nlvmfile
  - ☐ domain → nlvmdc
- ☐ Pas aan indien nodig
- ☐ Of voeg nieuwe toe

### 4. Azure DevOps Configureren

#### Productie
- ☐ Ga naar "Azure DevOps" tab
- ☐ Click "Add Configuration"
- ☐ Fill in:
  - Environment: `production`
  - Organization: {van stap 5}
  - Project: {van stap 5}
  - Repository: {van stap 5}
  - Personal Access Token: {van stap 5}
  - Default Branch: `main`
- ☐ Click "Test Connection"
- ☐ Verify: "Connection successful"
- ☐ Click "Save"

#### Acceptatie
- ☐ Herhaal voor `acceptance` (kan andere repo zijn)
- ☐ Test connection
- ☐ Save

### 5. Pipeline Configuratie

**Voor elke combinatie van Environment + Server Type:**

#### Productie - Application Server
- ☐ Ga naar "Pipelines" tab
- ☐ Click "Add Pipeline"
- ☐ Fill in:
  - Environment: `production`
  - Server Type: `application`
  - Pipeline Name: "VM-Deployment-Production"
  - Pipeline ID: {haal op uit DevOps}
  - Terraform Path: `terraform`
- ☐ Click "Save"

#### Herhaal voor andere combinaties:
- ☐ Production - SQL
- ☐ Production - Web
- ☐ Acceptance - Application
- ☐ Acceptance - SQL
- ☐ Etc.

**Pipeline ID vinden:**
```bash
# Via Azure DevOps URL:
# https://dev.azure.com/{org}/{project}/_build?definitionId={ID}
# Of via API
```

### 6. Email Notificaties

- ☐ Ga naar "Email Config" tab
- ☐ Fill in:
  - Enabled: ✓
  - Notify on Start: ✓
  - Notify on Completion: ✓
  - Notify on Failure: ✓
  - Recipient Emails: ["admin@example.com", "devops@example.com"]
- ☐ Click "Save"

---

## ☐ Fase 4: Azure DevOps Pipeline Setup (15 min)

### Pipeline YAML Aanmaken

#### 1. Create Pipeline File
- ☐ In je repository: Create `azure-pipelines-vm-deployment.yml`
- ☐ Paste pipeline configuration (zie hieronder)
- ☐ Commit to main branch

#### 2. Pipeline YAML Template

```yaml
trigger:
  branches:
    include:
      - deploy/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  - name: terraformVersion
    value: '1.6.0'

stages:
- stage: Validate
  displayName: 'Validate Terraform'
  jobs:
  - job: Validate
    steps:
    - task: TerraformInstaller@0
      inputs:
        terraformVersion: $(terraformVersion)
    
    - task: TerraformTaskV4@4
      displayName: 'Terraform Init'
      inputs:
        provider: 'azurerm'
        command: 'init'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        backendServiceArm: 'Azure-Production-ServiceConnection'
        backendAzureRmResourceGroupName: 'rg-terraform-state-prod'
        backendAzureRmStorageAccountName: 'tfstateprod12345'
        backendAzureRmContainerName: 'tfstate'
    
    - task: TerraformTaskV4@4
      displayName: 'Terraform Validate'
      inputs:
        provider: 'azurerm'
        command: 'validate'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'

- stage: Plan
  displayName: 'Terraform Plan'
  dependsOn: Validate
  jobs:
  - job: Plan
    steps:
    - task: TerraformInstaller@0
      inputs:
        terraformVersion: $(terraformVersion)
    
    - task: TerraformTaskV4@4
      displayName: 'Terraform Init'
      inputs:
        provider: 'azurerm'
        command: 'init'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        backendServiceArm: 'Azure-Production-ServiceConnection'
    
    - task: TerraformTaskV4@4
      displayName: 'Terraform Plan'
      inputs:
        provider: 'azurerm'
        command: 'plan'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        environmentServiceNameAzureRM: 'Azure-Production-ServiceConnection'
        commandOptions: '-out=tfplan'
    
    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        artifact: 'terraform-plan'

- stage: Apply
  displayName: 'Terraform Apply'
  dependsOn: Plan
  condition: succeeded()
  jobs:
  - deployment: Apply
    environment: 'Production-VMs'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: DownloadPipelineArtifact@2
            inputs:
              artifactName: 'terraform-plan'
              targetPath: '$(System.DefaultWorkingDirectory)/terraform'
          
          - task: TerraformInstaller@0
            inputs:
              terraformVersion: $(terraformVersion)
          
          - task: TerraformTaskV4@4
            displayName: 'Terraform Apply'
            inputs:
              provider: 'azurerm'
              command: 'apply'
              workingDirectory: '$(System.DefaultWorkingDirectory)/terraform'
              environmentServiceNameAzureRM: 'Azure-Production-ServiceConnection'
              commandOptions: '-auto-approve tfplan'
```

#### 3. Create Pipeline in Azure DevOps
- ☐ Ga naar Pipelines → New Pipeline
- ☐ Select: Azure Repos Git
- ☐ Select je repository
- ☐ Select: Existing Azure Pipelines YAML file
- ☐ Choose: `/azure-pipelines-vm-deployment.yml`
- ☐ Click "Run" om te testen (zal falen zonder deploy branch, dat is OK)
- ☐ **Noteer Pipeline ID** van de URL

#### 4. Create Service Connection
- ☐ Project Settings → Service connections
- ☐ New service connection → Azure Resource Manager
- ☐ Service principal (automatic) of (manual)
- ☐ Subscription: Select prod subscription
- ☐ Service connection name: "Azure-Production-ServiceConnection"
- ☐ Grant permission to all pipelines: ✓
- ☐ Herhaal voor acceptatie

---

## ☐ Fase 5: Test Deployment (10 min)

### Eerste VM Deployen

#### Via UI:
1. ☐ Ga naar "Azure Deployment" pagina
2. ☐ Select Environment: `production`
3. ☐ Wait for resources to load (VM sizes, VNets, RGs)
4. ☐ Select Server Type: `application`
5. ☐ Verify suggested VM name: `nlvmapp01` (of volgende beschikbare)
6. ☐ Select Resource Group
7. ☐ Select VM Size (bijv. `Standard_B2s`)
8. ☐ Verify CPU/RAM details worden getoond
9. ☐ Select Virtual Network
10. ☐ Select Subnet
11. ☐ OS Type: `Linux`
12. ☐ OS Disk Size: `128` GB
13. ☐ (Optional) Add data disks
14. ☐ Click "Deploy VM"

#### Verwachte Flow:
- ☐ Confirmation dialog
- ☐ Success message: "Deployment initiated"
- ☐ Deployment details shown met:
  - VM Name
  - Branch Name: `deploy/nlvmapp01`
  - Pipeline Run URL
  - Terraform Path
- ☐ Email notification ontvangen

#### Verify in Azure DevOps:
- ☐ Check branch `deploy/nlvmapp01` bestaat
- ☐ Check Terraform files in branch:
  - `/terraform/nlvmapp01/main.tf`
  - `/terraform/nlvmapp01/terraform.tfvars`
  - `/terraform/nlvmapp01/README.md`
- ☐ Check pipeline is getriggered
- ☐ Monitor pipeline run

#### Check Deployment History:
- ☐ Ga naar "Deployment History"
- ☐ Zie deployment in lijst
- ☐ Status: "deploying"
- ☐ Click "View Status"
- ☐ Check pipeline status updates

---

## ☐ Fase 6: Production Deployment (Azure Web App)

### Option A: Manual Deployment

```bash
# 1. Create App Service Plan
az appservice plan create \
  --name vm-deployment-plan \
  --resource-group rg-tools \
  --sku B1 \
  --is-linux

# 2. Create Web App
az webapp create \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --plan vm-deployment-plan \
  --runtime "NODE:18-lts"

# 3. Enable Managed Identity
az webapp identity assign \
  --name vm-deployment-tool \
  --resource-group rg-tools

# 4. Get Managed Identity Principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --query principalId -o tsv)

# 5. Assign Contributor role to subscriptions
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role Contributor \
  --scope /subscriptions/{prod-subscription-id}

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role Contributor \
  --scope /subscriptions/{acc-subscription-id}

# 6. Configure App Settings
az webapp config appsettings set \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --settings \
    USE_MANAGED_IDENTITY=true \
    NODE_ENV=production \
    PORT=8080

# 7. Deploy code
cd /path/to/timesheet
zip -r deploy.zip . -x "*.git*" "node_modules/*"
az webapp deployment source config-zip \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --src deploy.zip

# 8. Check logs
az webapp log tail \
  --name vm-deployment-tool \
  --resource-group rg-tools
```

### Option B: GitHub Actions Deployment

Create `.github/workflows/deploy-azure.yml`:

```yaml
name: Deploy to Azure Web App

on:
  push:
    branches:
      - main
    paths:
      - 'routes/azure-deployment*.js'
      - 'utils/azure-*.js'
      - 'scripts/init-azure-deployment-db.js'
      - 'public/js/azure-deployment.js'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci --production
    
    - name: Zip artifact
      run: zip -r deploy.zip . -x "*.git*"
    
    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: vm-deployment-tool
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: deploy.zip
```

---

## ☐ Fase 7: Monitoring & Maintenance

### Setup Monitoring
- ☐ Enable Application Insights op Web App
- ☐ Create alerts voor:
  - Deployment failures
  - API errors
  - High latency
  - Resource limits

### Regular Maintenance
- ☐ Update Azure SDK packages monthly
- ☐ Rotate Service Principal secrets (90 days)
- ☐ Rotate DevOps PAT (before expiry)
- ☐ Review deployment history
- ☐ Clean up old branches in DevOps
- ☐ Monitor Terraform state files

### Backup
- ☐ Backup database (data.db) daily
- ☐ Backup Storage Account (geo-redundant)
- ☐ Document all credentials in secure vault

---

## ✅ Setup Compleet!

Je hebt nu:
- ✅ Azure VM Deployment Tool volledig geconfigureerd
- ✅ Multi-environment support (prod/acc)
- ✅ Automatic Terraform generation
- ✅ Azure DevOps integration
- ✅ Email notifications
- ✅ Deployment history tracking
- ✅ Production-ready setup

## Volgende Features (Optional)

- ☐ Cost estimation per VM
- ☐ VM templates/blueprints
- ☐ Bulk deployments
- ☐ Auto-scaling groups (VMSS)
- ☐ Monitoring integration
- ☐ Backup automation
- ☐ Compliance checks

## Troubleshooting

Zie `AZURE-VM-DEPLOYMENT-GUIDE.md` sectie "Troubleshooting" voor:
- Azure connection issues
- DevOps connection issues
- Pipeline failures
- Terraform state issues
- VM name conflicts

---

**Setup Time Estimate:**
- Fase 1: 15 min
- Fase 2: 10 min
- Fase 3: 20 min
- Fase 4: 15 min
- Fase 5: 10 min
- Fase 6: 30 min (optional)
- **Total: ~60-90 minuten**

**Succes met je Azure VM Deployment Tool!** 🚀
