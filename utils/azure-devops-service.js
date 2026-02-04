/**
 * Azure DevOps Service - Handles repository operations and pipeline triggers
 * Uses Azure DevOps REST API
 */

const axios = require('axios');

class AzureDevOpsService {
  constructor(config = {}) {
    this.organization = config.organization;
    this.project = config.project;
    this.repository = config.repository;
    this.personalAccessToken = config.personalAccessToken;
    this.apiVersion = '7.0';
    
    // Base URLs
    this.baseUrl = `https://dev.azure.com/${this.organization}/${this.project}`;
    this.apiUrl = `${this.baseUrl}/_apis`;
    
    // Setup axios with authentication
    this.api = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${this.personalAccessToken}`).toString('base64')}`,
      },
    });
  }

  /**
   * Create a new branch in the repository
   */
  async createBranch(branchName, baseBranch = 'main') {
    try {
      // Get the latest commit from the base branch
      const refUrl = `${this.apiUrl}/git/repositories/${this.repository}/refs?filter=heads/${baseBranch}&api-version=${this.apiVersion}`;
      const refResponse = await this.api.get(refUrl);
      
      if (!refResponse.data.value || refResponse.data.value.length === 0) {
        throw new Error(`Base branch '${baseBranch}' not found`);
      }
      
      const baseCommitId = refResponse.data.value[0].objectId;
      
      // Create new branch
      const createBranchUrl = `${this.apiUrl}/git/repositories/${this.repository}/refs?api-version=${this.apiVersion}`;
      const branchData = [{
        name: `refs/heads/${branchName}`,
        oldObjectId: '0000000000000000000000000000000000000000',
        newObjectId: baseCommitId,
      }];
      
      const response = await this.api.post(createBranchUrl, branchData);
      
      return {
        success: true,
        branchName: branchName,
        commitId: baseCommitId,
        data: response.data,
      };
    } catch (error) {
      console.error('Error creating branch:', error.response?.data || error.message);
      throw new Error(`Failed to create branch: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Push files to a branch (commit)
   */
  async commitFiles(branchName, files, commitMessage) {
    try {
      // files should be an array of: { path: string, content: string }
      
      // Get the latest commit from the branch
      const refUrl = `${this.apiUrl}/git/repositories/${this.repository}/refs?filter=heads/${branchName}&api-version=${this.apiVersion}`;
      const refResponse = await this.api.get(refUrl);
      
      if (!refResponse.data.value || refResponse.data.value.length === 0) {
        throw new Error(`Branch '${branchName}' not found`);
      }
      
      const oldObjectId = refResponse.data.value[0].objectId;
      
      // Prepare changes
      const changes = files.map(file => ({
        changeType: 'add',
        item: {
          path: file.path,
        },
        newContent: {
          content: file.content,
          contentType: 'rawtext',
        },
      }));
      
      // Create commit
      const pushUrl = `${this.apiUrl}/git/repositories/${this.repository}/pushes?api-version=${this.apiVersion}`;
      const pushData = {
        refUpdates: [{
          name: `refs/heads/${branchName}`,
          oldObjectId: oldObjectId,
        }],
        commits: [{
          comment: commitMessage,
          changes: changes,
        }],
      };
      
      const response = await this.api.post(pushUrl, pushData);
      
      return {
        success: true,
        commitId: response.data.commits[0].commitId,
        pushId: response.data.pushId,
        data: response.data,
      };
    } catch (error) {
      console.error('Error committing files:', error.response?.data || error.message);
      throw new Error(`Failed to commit files: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Trigger a pipeline
   */
  async triggerPipeline(pipelineId, branchName, parameters = {}) {
    try {
      const pipelineUrl = `${this.apiUrl}/pipelines/${pipelineId}/runs?api-version=${this.apiVersion}`;
      
      const runData = {
        resources: {
          repositories: {
            self: {
              refName: `refs/heads/${branchName}`,
            },
          },
        },
        templateParameters: parameters,
      };
      
      const response = await this.api.post(pipelineUrl, runData);
      
      return {
        success: true,
        runId: response.data.id,
        runUrl: response.data._links.web.href,
        state: response.data.state,
        data: response.data,
      };
    } catch (error) {
      console.error('Error triggering pipeline:', error.response?.data || error.message);
      throw new Error(`Failed to trigger pipeline: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get pipeline run status
   */
  async getPipelineRunStatus(runId) {
    try {
      const runUrl = `${this.apiUrl}/pipelines/runs/${runId}?api-version=${this.apiVersion}`;
      const response = await this.api.get(runUrl);
      
      return {
        success: true,
        runId: response.data.id,
        state: response.data.state, // 'inProgress', 'completed', 'canceling', 'canceled'
        result: response.data.result, // 'succeeded', 'failed', 'canceled'
        createdDate: response.data.createdDate,
        finishedDate: response.data.finishedDate,
        url: response.data._links.web.href,
        data: response.data,
      };
    } catch (error) {
      console.error('Error getting pipeline status:', error.response?.data || error.message);
      throw new Error(`Failed to get pipeline status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * List pipelines in the project
   */
  async listPipelines() {
    try {
      const pipelinesUrl = `${this.apiUrl}/pipelines?api-version=${this.apiVersion}`;
      const response = await this.api.get(pipelinesUrl);
      
      return {
        success: true,
        pipelines: response.data.value.map(pipeline => ({
          id: pipeline.id,
          name: pipeline.name,
          folder: pipeline.folder,
          revision: pipeline.revision,
        })),
      };
    } catch (error) {
      console.error('Error listing pipelines:', error.response?.data || error.message);
      throw new Error(`Failed to list pipelines: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * List repositories in the project
   */
  async listRepositories() {
    try {
      const reposUrl = `${this.apiUrl}/git/repositories?api-version=${this.apiVersion}`;
      const response = await this.api.get(reposUrl);
      
      return {
        success: true,
        repositories: response.data.value.map(repo => ({
          id: repo.id,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          remoteUrl: repo.remoteUrl,
        })),
      };
    } catch (error) {
      console.error('Error listing repositories:', error.response?.data || error.message);
      throw new Error(`Failed to list repositories: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Test connection to Azure DevOps
   */
  async testConnection() {
    try {
      const projectUrl = `https://dev.azure.com/${this.organization}/_apis/projects/${this.project}?api-version=${this.apiVersion}`;
      const response = await this.api.get(projectUrl);
      
      return {
        success: true,
        projectName: response.data.name,
        projectId: response.data.id,
        state: response.data.state,
      };
    } catch (error) {
      console.error('Error testing connection:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Create deployment workflow: branch + commit + trigger pipeline
   */
  async createDeploymentWorkflow(vmName, terraformFiles, pipelineId, baseBranch = 'main') {
    const results = {
      branch: null,
      commit: null,
      pipeline: null,
      errors: [],
    };

    try {
      // Step 1: Create branch
      console.log(`Creating branch for VM: ${vmName}`);
      const branchName = `deploy/${vmName}`;
      const branchResult = await this.createBranch(branchName, baseBranch);
      results.branch = branchResult;
      
      // Step 2: Commit Terraform files
      console.log(`Committing Terraform files to branch: ${branchName}`);
      const commitResult = await this.commitFiles(
        branchName,
        terraformFiles,
        `Add Terraform configuration for VM: ${vmName}`
      );
      results.commit = commitResult;
      
      // Step 3: Trigger pipeline
      console.log(`Triggering pipeline for deployment: ${vmName}`);
      const pipelineResult = await this.triggerPipeline(pipelineId, branchName, {
        vmName: vmName,
      });
      results.pipeline = pipelineResult;
      
      return {
        success: true,
        branchName: branchName,
        commitId: commitResult.commitId,
        runId: pipelineResult.runId,
        runUrl: pipelineResult.runUrl,
        results: results,
      };
    } catch (error) {
      console.error('Error in deployment workflow:', error);
      results.errors.push(error.message);
      
      return {
        success: false,
        error: error.message,
        results: results,
      };
    }
  }

  /**
   * Wait for pipeline completion and return final status
   */
  async waitForPipelineCompletion(runId, maxWaitTimeMs = 30 * 60 * 1000, pollIntervalMs = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      const status = await this.getPipelineRunStatus(runId);
      
      if (status.state === 'completed') {
        return {
          success: true,
          result: status.result,
          status: status,
        };
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    return {
      success: false,
      error: 'Pipeline did not complete within the maximum wait time',
    };
  }
}

module.exports = AzureDevOpsService;
