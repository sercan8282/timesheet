# Azure VM Deployment Tool - Quick Start

## Wat is dit?

Een geautomatiseerde tool voor het deployen van Azure Virtual Machines via een webinterface met automatische Terraform code generatie en Azure DevOps pipeline integratie.

## Snelle Start

### 1. Installeren

```bash
# Install dependencies
npm install

# Initialize database
node scripts/init-azure-deployment-db.js

# Start server
npm start
```

### 2. Azure Service Principal Aanmaken

```bash
# Create Service Principal
az ad sp create-for-rbac --name "vm-deployment-tool" --role Contributor --scopes /subscriptions/{subscription-id}

# Noteer:
# - tenant (Tenant ID)
# - appId (Client ID)
# - password (Client Secret)
# - subscription ID
```

### 3. Azure DevOps PAT Aanmaken

1. Ga naar Azure DevOps → User Settings → Personal access tokens
2. New Token met scopes:
   - Code: Read & Write
   - Build: Read & Execute
3. Noteer de token value

### 4. Configureren via GUI

Login als admin → Azure Deployment Config:

1. **Azure Credentials**: Voer Service Principal gegevens in
2. **State Storage**: Configureer Storage Account voor Terraform state
3. **DevOps**: Voer organization, project, repository en PAT in
4. **Pipelines**: Koppel pipelines aan environment + server type
5. **Test**: Test alle connecties

### 5. Deploy een VM

1. Ga naar "Azure Deployment"
2. Selecteer environment (production/acceptance)
3. Kies server type (application/sql/web)
4. Configureer VM (size, network, disks)
5. Klik "Deploy VM"
6. Pipeline start automatisch in Azure DevOps

## Belangrijkste Features

✅ Multi-environment support (prod/acc)  
✅ Automatische VM naming (nlvmapp01, nlvmapp02, etc.)  
✅ Azure resource queries (SKUs, VNets, RGs)  
✅ Terraform code generatie  
✅ Azure DevOps integration (branch + commit + pipeline)  
✅ Email notificaties  
✅ Deployment history tracking  
✅ Admin configuration GUI

## Vereiste Azure Resources

1. **Service Principal** - Voor Azure API toegang
2. **Storage Account** - Voor Terraform state files
3. **Azure DevOps** - Repository en pipeline
4. **Azure Subscription** - Waar VMs gedeployed worden

## API Endpoints

- `GET /api/azure-deployment/server-types` - Server types
- `GET /api/azure-deployment/vm-sizes` - VM sizes voor environment
- `POST /api/azure-deployment/deploy` - Deploy nieuwe VM
- `GET /api/azure-deployment/deployments` - Deployment history
- `GET /api/azure-deployment-config/*` - Configuration (admin)

## Terraform Pipeline

Maak een pipeline in Azure DevOps die triggert op `deploy/*` branches:

```yaml
trigger:
  branches:
    include:
      - deploy/*

stages:
- stage: Deploy
  jobs:
  - job: Terraform
    steps:
    - task: TerraformInstaller@0
    - task: TerraformTaskV4@4
      inputs:
        command: 'init'
    - task: TerraformTaskV4@4
      inputs:
        command: 'apply'
        commandOptions: '-auto-approve'
```

## Managed Identity (Aanbevolen)

Voor Azure Web App deployment:

```bash
# Enable Managed Identity
az webapp identity assign --name vm-deployment-tool --resource-group rg-tools

# Set environment variable
az webapp config appsettings set \
  --name vm-deployment-tool \
  --settings USE_MANAGED_IDENTITY=true
```

## Architectuur

```
[Web UI] → [Express API] → [Azure SDK] → [Azure]
                ↓              ↓
         [SQLite DB]   [DevOps API] → [Pipeline] → [Terraform] → [VM]
```

## Documentatie

Zie `AZURE-VM-DEPLOYMENT-GUIDE.md` voor uitgebreide documentatie.

## Support

Voor vragen of problemen, maak een GitHub issue aan.

---

**Versie:** 1.0.0  
**Node.js:** >= 14.x  
**Deployment:** Azure Web App (aanbevolen)
