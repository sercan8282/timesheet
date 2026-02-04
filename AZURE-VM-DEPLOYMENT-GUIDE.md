# Azure VM Deployment Automation Tool

## Overzicht

Dit is een geautomatiseerde Azure VM deployment tool die is geïntegreerd in het timesheet management systeem. De tool maakt het mogelijk om via een webinterface Azure Virtual Machines te deployen met automatische Terraform code generatie en Azure DevOps pipeline integratie.

## Features

✅ **Multi-Environment Support**
- Productie en acceptatie omgevingen
- Aparte Azure credentials per omgeving
- Configureerbare Terraform state storage per omgeving

✅ **Intelligente VM Naming**
- Configureerbare naming patterns per server type
- Automatische next available naam generatie
- Voorkomt naam conflicten in Azure

✅ **Azure Resource Integration**
- Ophalen van beschikbare VM SKUs met specificaties
- Lijst van Virtual Networks en Subnets
- Resource Groups per subscription
- Realtime Azure resource data

✅ **Terraform Code Generatie**
- Automatische generatie van Terraform configuratie
- Support voor Linux en Windows VMs
- OS disk en data disk configuratie
- Network interface en Public IP setup
- State file management naar Azure Storage

✅ **Azure DevOps Integration**
- Automatische branch creatie per deployment
- Commit van Terraform bestanden
- Pipeline trigger voor deployment
- Status tracking van pipeline runs

✅ **Email Notificaties**
- Bij deployment start
- Bij successful completion
- Bij failure
- Configureerbare recipients

✅ **Backend Configuration GUI**
- Admin interface voor alle configuraties
- Azure credential management
- DevOps repository configuratie
- Pipeline mapping per server type
- Test connecties naar Azure en DevOps

## Architectuur

### Technology Stack

**Backend:**
- Node.js / Express
- Azure SDK voor JavaScript
- SQLite database
- REST API

**Frontend:**
- Vanilla JavaScript
- Bootstrap 5
- Responsive design

**Azure Integration:**
- Azure SDK (@azure/arm-compute, @azure/arm-network, etc.)
- Azure DevOps REST API
- Azure Storage voor Terraform state

### Database Schema

De tool gebruikt 8 database tabellen:

1. **azure_credentials** - Azure Service Principal credentials per environment
2. **terraform_state_config** - Storage account configuratie voor state files
3. **vm_naming_patterns** - VM naming patterns per server type
4. **azure_devops_config** - DevOps organization/project/repository config
5. **pipeline_config** - Pipeline mappings per environment en server type
6. **repository_config** - Repository mappings per server type
7. **vm_deployments** - Deployment history en status tracking
8. **deployment_email_config** - Email notification settings

## Installatie

### Stap 1: Dependencies Installeren

```bash
npm install
```

Dit installeert alle vereiste Azure SDK packages:
- @azure/arm-compute
- @azure/arm-network
- @azure/arm-resources
- @azure/arm-storage
- @azure/arm-subscriptions
- @azure/identity
- @azure/storage-blob
- axios

### Stap 2: Database Initialiseren

Voer het database initialization script uit:

```bash
node scripts/init-azure-deployment-db.js
```

Dit creëert alle benodigde tabellen en insert default data:
- Default VM naming patterns (nlvmapp, nlvmdb, nlvmweb, etc.)
- Default email configuration

### Stap 3: Server Starten

```bash
npm start
```

De Azure deployment endpoints zijn nu beschikbaar op:
- `/api/azure-deployment/*` - Deployment operations
- `/api/azure-deployment-config/*` - Configuration (admin only)

## Configuratie

### Azure Service Principal Setup

Voor elke omgeving (productie/acceptatie) moet je een Azure Service Principal aanmaken:

1. **Login naar Azure Portal**
2. **Ga naar Azure Active Directory → App registrations**
3. **Klik op "+ New registration"**
   - Name: "Timesheet-VM-Deployment-Production"
   - Account type: "Single tenant"
4. **Noteer de volgende waardes:**
   - Tenant ID
   - Client ID (Application ID)
5. **Ga naar "Certificates & secrets"**
   - Maak een nieuwe Client Secret aan
   - Noteer de Secret Value (verdwijnt na verlaten pagina!)
6. **Ga naar "Subscriptions" in Azure Portal**
   - Selecteer je subscription
   - Noteer de Subscription ID
   - Ga naar "Access control (IAM)"
   - Voeg toe: "Contributor" role voor je Service Principal

### Backend Configuratie via GUI

Login als admin en ga naar de Azure Deployment Configuration pagina:

#### 1. Azure Credentials Configureren

Voor elke omgeving:
- Environment: "production" of "acceptance"
- Tenant ID: Van je App Registration
- Client ID: Van je App Registration
- Client Secret: Secret Value
- Subscription ID: Je Azure Subscription ID
- Klik op "Test Connection" om te valideren
- Klik op "Save"

#### 2. Terraform State Storage Configureren

Maak eerst een Storage Account aan in Azure voor Terraform state:

```bash
# Azure CLI voorbeeld
az storage account create \
  --name tfstateproduction \
  --resource-group terraform-state-rg \
  --location westeurope \
  --sku Standard_LRS

az storage container create \
  --name tfstate \
  --account-name tfstateproduction
```

In de GUI configureer je dan:
- Environment: "production"
- Storage Account Name: "tfstateproduction"
- Container Name: "tfstate"
- Resource Group: "terraform-state-rg"
- Access Key: (haal op uit Azure Portal of CLI)

#### 3. VM Naming Patterns Configureren

Default patterns zijn al aanwezig, maar je kunt ze aanpassen:
- Server Type: bijv. "application", "sql", "web"
- Naming Pattern: bijv. "nlvmapp", "nlvmdb"
- Description: Omschrijving van het server type

De tool zoekt automatisch de eerst volgende beschikbare naam:
- nlvmapp01, nlvmapp02, nlvmapp03, etc.

#### 4. Azure DevOps Configureren

Maak eerst een Personal Access Token (PAT) aan in Azure DevOps:
1. Ga naar je DevOps organization
2. User Settings → Personal access tokens
3. New Token met scopes: Code (Read & Write), Build (Read & Execute)

In de GUI configureer je:
- Environment: "production" of "acceptance"
- Organization: Je DevOps organization naam
- Project: Project naam
- Repository: Repository naam
- Personal Access Token: Je PAT
- Default Branch: "main" (of andere)
- Klik op "Test Connection"
- Klik op "Save"

#### 5. Pipeline Configuratie

Voor elke combinatie van environment + server type:
- Environment: "production"
- Server Type: "application"
- Pipeline Name: "VM-Deployment-Pipeline"
- Pipeline ID: (haal op uit DevOps URL of API)
- Terraform Path: "terraform" (pad in repo waar TF files komen)

#### 6. Email Notificaties Configureren

- Enabled: ✓
- Notify on Start: ✓
- Notify on Completion: ✓
- Notify on Failure: ✓
- Recipient Emails: ["admin@example.com", "devops@example.com"]

## Gebruik

### VM Deployen via UI

1. **Navigeer naar Azure Deployment pagina**
2. **Selecteer Environment** (productie/acceptatie)
   - VM sizes, VNets en Resource Groups worden automatisch geladen
3. **Selecteer Server Type** (application/sql/web/etc.)
   - Automatisch suggest van volgende beschikbare VM naam
4. **Configureer VM:**
   - VM Name: (vooraf ingevuld, aanpasbaar)
   - Resource Group: Selecteer uit lijst
   - Location: westeurope (standaard)
   - VM Size: Selecteer uit lijst met CPU/RAM info
   - Virtual Network: Selecteer uit lijst
   - Subnet: Selecteer uit lijst (gebaseerd op VNet)
   - OS Type: Linux of Windows
   - OS Disk Size: GB (standaard 128)
   - Data Disks: Klik "Add Disk" voor extra schijven
5. **Klik "Deploy VM"**

### Wat gebeurt er bij deployment?

1. **Validatie**: Alle required fields worden gecheckt
2. **Database Record**: Deployment wordt opgeslagen met status "pending"
3. **Terraform Generatie**: 
   - main.tf met volledige VM configuratie
   - terraform.tfvars met variables
   - README.md met deployment instructies
4. **Azure DevOps Workflow**:
   - Nieuwe branch wordt aangemaakt: `deploy/{vm-name}`
   - Terraform files worden gecommit
   - Pipeline wordt getriggerd
5. **Status Update**: Status wordt "deploying"
6. **Email**: Notificatie naar configured recipients
7. **Pipeline Execution**: Azure DevOps voert Terraform uit
8. **Completion**: Status wordt "completed" of "failed"

### Deployment Status Bekijken

- Ga naar "Deployment History"
- Lijst toont alle deployments met status
- Klik op "View Status" voor realtime pipeline status
- Status wordt elke 30 seconden ge-refresh

## API Endpoints

### Deployment Endpoints (Authenticated Users)

#### GET /api/azure-deployment/config/environments
Haal lijst van geconfigureerde environments op.

#### GET /api/azure-deployment/server-types
Haal server types met naming patterns op.

#### GET /api/azure-deployment/vm-sizes?environment={env}&location={loc}
Haal beschikbare VM sizes op voor een environment.

#### GET /api/azure-deployment/virtual-networks?environment={env}
Haal virtual networks op voor een environment.

#### GET /api/azure-deployment/resource-groups?environment={env}
Haal resource groups op voor een environment.

#### POST /api/azure-deployment/check-vm-name
Check VM name beschikbaarheid en suggest next available.

```json
{
  "environment": "production",
  "serverType": "application",
  "customName": "nlvmtest01"
}
```

#### POST /api/azure-deployment/deploy
Deploy een nieuwe VM.

```json
{
  "environment": "production",
  "serverType": "application",
  "vmName": "nlvmapp05",
  "resourceGroup": "rg-vms-prod",
  "location": "westeurope",
  "vmSize": "Standard_D2s_v3",
  "virtualNetwork": "/subscriptions/.../virtualNetworks/vnet-prod",
  "subnet": "default",
  "osType": "Linux",
  "osDiskSize": 128,
  "dataDisks": [256, 512],
  "adminUsername": "azureuser"
}
```

#### GET /api/azure-deployment/deployments
Haal deployment history op.

#### GET /api/azure-deployment/deployments/:id/status
Haal deployment en pipeline status op.

### Configuration Endpoints (Admin Only)

#### Azure Credentials
- GET /api/azure-deployment-config/credentials
- POST /api/azure-deployment-config/credentials
- DELETE /api/azure-deployment-config/credentials/:environment
- POST /api/azure-deployment-config/credentials/test

#### Terraform State Config
- GET /api/azure-deployment-config/state-config
- POST /api/azure-deployment-config/state-config

#### VM Naming Patterns
- GET /api/azure-deployment-config/naming-patterns
- POST /api/azure-deployment-config/naming-patterns
- DELETE /api/azure-deployment-config/naming-patterns/:serverType

#### Azure DevOps Config
- GET /api/azure-deployment-config/devops-config
- POST /api/azure-deployment-config/devops-config
- POST /api/azure-deployment-config/devops-config/test

#### Pipeline Config
- GET /api/azure-deployment-config/pipeline-config
- POST /api/azure-deployment-config/pipeline-config
- DELETE /api/azure-deployment-config/pipeline-config/:environment/:serverType

#### Email Config
- GET /api/azure-deployment-config/email-config
- POST /api/azure-deployment-config/email-config

## Terraform Pipeline Setup

### Azure DevOps Pipeline YAML Example

Maak een pipeline aan in Azure DevOps met deze YAML:

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
  jobs:
  - job: ValidateTerraform
    steps:
    - task: TerraformInstaller@0
      inputs:
        terraformVersion: $(terraformVersion)
    
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'init'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        backendServiceArm: 'Azure-Service-Connection'
    
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'validate'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'

- stage: Plan
  dependsOn: Validate
  jobs:
  - job: TerraformPlan
    steps:
    - task: TerraformInstaller@0
      inputs:
        terraformVersion: $(terraformVersion)
    
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'init'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        backendServiceArm: 'Azure-Service-Connection'
    
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'plan'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
        environmentServiceNameAzureRM: 'Azure-Service-Connection'
        commandOptions: '-out=tfplan'

- stage: Apply
  dependsOn: Plan
  condition: succeeded()
  jobs:
  - deployment: TerraformApply
    environment: 'Production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: TerraformInstaller@0
            inputs:
              terraformVersion: $(terraformVersion)
          
          - task: TerraformTaskV4@4
            inputs:
              provider: 'azurerm'
              command: 'init'
              workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
              backendServiceArm: 'Azure-Service-Connection'
          
          - task: TerraformTaskV4@4
            inputs:
              provider: 'azurerm'
              command: 'apply'
              workingDirectory: '$(System.DefaultWorkingDirectory)/terraform/$(Build.SourceBranchName)'
              environmentServiceNameAzureRM: 'Azure-Service-Connection'
              commandOptions: '-auto-approve'
```

## Security Best Practices

### Managed Identity (Aanbevolen voor Production)

Als de tool als Azure Web App draait, gebruik dan Managed Identity:

1. **Enable Managed Identity op de Web App**
2. **Geef de Managed Identity Contributor rechten op je subscriptions**
3. **Zet in .env:**
   ```
   USE_MANAGED_IDENTITY=true
   ```
4. **Azure SDK gebruikt dan automatisch de Managed Identity**

Voordelen:
- Geen credentials in configuratie
- Automatische credential rotation
- Azure managed security

### Credential Management

- Service Principal secrets worden encrypted opgeslagen in database
- Personal Access Tokens voor DevOps zijn masked in API responses
- Storage Account access keys zijn optioneel (gebruik Managed Identity)

### Network Security

Als Web App in Azure:
- Gebruik Virtual Network integration
- Enable Azure Firewall
- Restrict inbound traffic
- Use Private Endpoints voor Storage Accounts

## Deployment naar Azure

### Als Azure Web App

1. **Create App Service Plan**
```bash
az appservice plan create \
  --name vm-deployment-tool-plan \
  --resource-group rg-tools \
  --sku B1 \
  --is-linux
```

2. **Create Web App**
```bash
az webapp create \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --plan vm-deployment-tool-plan \
  --runtime "NODE:18-lts"
```

3. **Enable Managed Identity**
```bash
az webapp identity assign \
  --name vm-deployment-tool \
  --resource-group rg-tools
```

4. **Deploy Code**
```bash
# Via GitHub Actions of Azure DevOps
# Of manual deployment:
az webapp deployment source config-zip \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --src deployment.zip
```

5. **Configure App Settings**
```bash
az webapp config appsettings set \
  --name vm-deployment-tool \
  --resource-group rg-tools \
  --settings USE_MANAGED_IDENTITY=true NODE_ENV=production
```

## Troubleshooting

### Azure Connection Fails

- Check Service Principal credentials
- Verify Subscription ID
- Check IAM roles (moet Contributor zijn)
- Test connection via GUI

### DevOps Connection Fails

- Verify PAT is nog geldig
- Check PAT scopes: Code (Read & Write), Build (Read & Execute)
- Verify organization/project/repository names

### Pipeline Trigger Fails

- Check Pipeline ID is correct
- Verify pipeline heeft trigger op deploy/* branches
- Check Service Connection in DevOps pipeline

### Terraform State File Issues

- Verify Storage Account exists
- Check container name
- Verify access key of Managed Identity permissions
- Check firewall rules op Storage Account

### VM Name Conflicts

- Tool checked automatisch beschikbaarheid
- Bij conflict: kies andere naam of verwijder bestaande VM

## Support en Uitbreidingen

### Mogelijke Uitbreidingen

1. **VM Size Recommendations**
   - AI-powered sizing based on workload type
   
2. **Cost Estimation**
   - Show estimated monthly costs before deployment
   
3. **Bulk Deployments**
   - Deploy multiple VMs at once
   
4. **VM Templates**
   - Save and reuse VM configurations
   
5. **Auto-scaling Groups**
   - Deploy VM Scale Sets
   
6. **Monitoring Integration**
   - Automatic Azure Monitor setup
   
7. **Backup Configuration**
   - Enable Azure Backup automatically
   
8. **Compliance Checks**
   - Validate against company policies

### Contributing

Voor bugs of feature requests, maak een GitHub issue aan.

## License

ISC License - Zie LICENSE file voor details.

---

**Gemaakt door:** Timesheet Management System Team  
**Versie:** 1.0.0  
**Laatste Update:** 2026-02-04
