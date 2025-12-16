// ========== ADMIN MODULE ==========
(function() {
  'use strict';
  console.log('[ADMIN] Admin module loading');

  // Global state
  var currentAdminTab = "users";
  let allUsers = [];
  let allCompanies = [];
  let selectedCompanyId = null;

  // ========== GLOBAL FUNCTIONS ==========

function switchAdminTab(tab) {
  currentAdminTab = tab;
  
  document.querySelectorAll(".nav-tabs .nav-link").forEach(link => {
    link.classList.remove("active");
  });
  
  const navLink = document.querySelector(`[data-tab="${tab}"]`);
  if (navLink) {
    navLink.classList.add("active");
  }
  
  const container = document.getElementById("adminContent");
  if (!container) return;
  
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';
  
  switch(tab) {
    case "users": loadAdminUsers(); break;
    case "companies": loadCompaniesManagement(); break;
    case "submissions": loadAdminSubmissions(); break;
    case "hours-report": loadHoursReport(); break;
    case "leave": loadLeaveManagement(); break;
    case "fleet": loadFleetManagement(); break;
    case "planning": loadPlanningManagement(); break;
    case "smtp": loadSMTPSettings(); break;
    case "branding": loadBrandingSettings(); break;
    default: container.innerHTML = '<div class="alert alert-info">Module not found</div>';
  }
}

async function initAdmin() {
  console.log('[ADMIN] initAdmin called');
  currentAdminTab = "users";
  await new Promise(resolve => setTimeout(resolve, 100));
  await switchAdminTab('users');
}

function showAddUserModal() {
  document.getElementById('addUserForm').reset();
  document.getElementById('addUserAlert').innerHTML = '';
  loadCompaniesForModal('addUserCompany', 'addFillInCompany');
  new bootstrap.Modal(document.getElementById('addUserModal')).show();
}

async function submitAddUser() {
  const username = document.getElementById('addUsername').value;
  const password = document.getElementById('addPassword').value;
  const fullName = document.getElementById('addFullName').value;
  
  if (!username || !password || !fullName) {
    document.getElementById('addUserAlert').innerHTML = '<div class="alert alert-danger">Username, Password and Full Name are required</div>';
    return;
  }
  
  try {
    await api.createUser({
      username,
      password,
      fullName,
      phone: document.getElementById('addPhone').value,
      ritnumber: document.getElementById('addRitnumber').value,
      role: document.getElementById('addRole').value,
      megaKast: document.getElementById('addMegaKast').value,
      adr: document.getElementById('addAdr').value === '1',
      companyId: document.getElementById('addUserCompany').value || null,
      canFillIn: document.getElementById('addCanFillIn').value === '1',
      fillInCompanyId: document.getElementById('addFillInCompany').value || null
    });
    document.getElementById('addUserAlert').innerHTML = '<div class="alert alert-success">User created successfully!</div>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
      loadAdminUsers();
    }, 1000);
  } catch (error) {
    document.getElementById('addUserAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function openEditUserModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  document.getElementById('editUserId').value = userId;
  document.getElementById('editUsername').value = user.username;
  document.getElementById('editFullName').value = user.full_name;
  document.getElementById('editPhone').value = user.phone || '';
  document.getElementById('editRitnumber').value = user.ritnumber || '';
  document.getElementById('editRole').value = user.role || 'user';
  document.getElementById('editMegaKast').value = user.mega_kast || 'only_mega';
  document.getElementById('editAdr').value = user.adr ? '1' : '0';
  document.getElementById('editCanFillIn').value = user.can_fill_in ? '1' : '0';
  
  loadCompaniesForModal('editCompany', 'editFillInCompany', user.company_id, user.fill_in_company_id);
  
  document.getElementById('editFillInCompanyContainer').style.display = user.can_fill_in ? 'block' : 'none';
  document.getElementById('editUserAlert').innerHTML = '';
  new bootstrap.Modal(document.getElementById('editUserModal')).show();
}

async function submitEditUser() {
  const userId = document.getElementById('editUserId').value;
  try {
    await api.updateUser(userId, {
      fullName: document.getElementById('editFullName').value,
      phone: document.getElementById('editPhone').value,
      ritnumber: document.getElementById('editRitnumber').value,
      role: document.getElementById('editRole').value,
      megaKast: document.getElementById('editMegaKast').value,
      adr: document.getElementById('editAdr').value === '1',
      companyId: document.getElementById('editCompany').value || null,
      canFillIn: document.getElementById('editCanFillIn').value === '1',
      fillInCompanyId: document.getElementById('editFillInCompany').value || null
    });
    document.getElementById('editUserAlert').innerHTML = '<div class="alert alert-success">Saved!</div>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
      loadAdminUsers();
    }, 1000);
  } catch (error) {
    document.getElementById('editUserAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function showAddCompanyModal() {
  document.getElementById('addCompanyForm').reset();
  document.getElementById('addCompanyPauseTime').value = '00:30';
  document.getElementById('addCompanyAlert').innerHTML = '';
  new bootstrap.Modal(document.getElementById('addCompanyModal')).show();
}

async function submitAddCompany() {
  const name = document.getElementById('addCompanyName').value;
  if (!name) {
    document.getElementById('addCompanyAlert').innerHTML = '<div class="alert alert-danger">Company name is required</div>';
    return;
  }
  
  try {
    await api.createCompany({
      name,
      phone: document.getElementById('addCompanyPhone').value,
      kvk: document.getElementById('addCompanyKvk').value,
      btw: document.getElementById('addCompanyBtw').value,
      address: document.getElementById('addCompanyAddress').value,
      postal_code: document.getElementById('addCompanyPostalCode').value,
      city: document.getElementById('addCompanyCity').value,
      pause_time: document.getElementById('addCompanyPauseTime').value || '00:30'
    });
    document.getElementById('addCompanyAlert').innerHTML = '<div class="alert alert-success">Company created successfully!</div>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('addCompanyModal')).hide();
      loadCompaniesManagement();
    }, 1000);
  } catch (error) {
    document.getElementById('addCompanyAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function openEditCompanyModal(companyId) {
  const company = allCompanies.find(c => c.id === companyId);
  if (!company) return;
  
  document.getElementById('editCompanyId').value = companyId;
  document.getElementById('editCompanyName').value = company.name;
  document.getElementById('editCompanyPhone').value = company.phone || '';
  document.getElementById('editCompanyKvk').value = company.kvk || '';
  document.getElementById('editCompanyBtw').value = company.btw || '';
  document.getElementById('editCompanyAddress').value = company.address || '';
  document.getElementById('editCompanyPostalCode').value = company.postal_code || '';
  document.getElementById('editCompanyCity').value = company.city || '';
  document.getElementById('editCompanyPauseTime').value = company.pause_time || '00:30';
  document.getElementById('editCompanyAlert').innerHTML = '';
  new bootstrap.Modal(document.getElementById('editCompanyModal')).show();
}

async function submitEditCompany() {
  const companyId = document.getElementById('editCompanyId').value;
  try {
    await api.updateCompany(companyId, {
      name: document.getElementById('editCompanyName').value,
      phone: document.getElementById('editCompanyPhone').value,
      kvk: document.getElementById('editCompanyKvk').value,
      btw: document.getElementById('editCompanyBtw').value,
      address: document.getElementById('editCompanyAddress').value,
      postal_code: document.getElementById('editCompanyPostalCode').value,
      city: document.getElementById('editCompanyCity').value,
      pause_time: document.getElementById('editCompanyPauseTime').value
    });
    document.getElementById('editCompanyAlert').innerHTML = '<div class="alert alert-success">Saved!</div>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('editCompanyModal')).hide();
      loadCompaniesManagement();
    }, 1000);
  } catch (error) {
    document.getElementById('editCompanyAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function selectCompany(companyId) {
  selectedCompanyId = companyId;
  loadCompaniesManagement();
}

function toggleAddFillInCompany() {
  const container = document.getElementById('addFillInCompanyContainer');
  const value = document.getElementById('addCanFillIn').value;
  container.style.display = value === '1' ? 'block' : 'none';
}

function toggleEditFillInCompany() {
  const container = document.getElementById('editFillInCompanyContainer');
  const value = document.getElementById('editCanFillIn').value;
  container.style.display = value === '1' ? 'block' : 'none';
}

async function loadCompaniesForModal(selectId, fillInSelectId, selectedCompanyId = null, selectedFillInCompanyId = null) {
  try {
    const companies = await api.getCompanies();
    const select = document.getElementById(selectId);
    const fillInSelect = document.getElementById(fillInSelectId);
    
    if (!select || !fillInSelect) return;
    
    const options = companies.map(c => `<option value="${c.id}" ${c.id === selectedCompanyId ? 'selected' : ''}>${c.name}</option>`).join('');
    const fillInOptions = companies.map(c => `<option value="${c.id}" ${c.id === selectedFillInCompanyId ? 'selected' : ''}>${c.name}</option>`).join('');
    
    select.innerHTML = '<option value="">No company</option>' + options;
    fillInSelect.innerHTML = '<option value="">Select company</option>' + fillInOptions;
  } catch (error) {
    console.error('[ADMIN] Error loading companies for modal:', error);
  }
}

// ========== RENDER ADMIN PORTAL ==========

function renderAdmin() {
  return `
    <div class="container-fluid mt-3">
      <div class="row">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0"><i class="bi bi-gear"></i> Admin Portal</h5>
            </div>
            <div class="card-body">
              <ul class="nav nav-tabs mb-3" role="tablist">
                <li class="nav-item">
                  <a class="nav-link active" href="#" data-tab="users" onclick="switchAdminTab('users'); return false;">
                    <i class="bi bi-people"></i> Users
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="companies" onclick="switchAdminTab('companies'); return false;">
                    <i class="bi bi-building"></i> Companies
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="submissions" onclick="switchAdminTab('submissions'); return false;">
                    <i class="bi bi-file-earmark-text"></i> Submissions
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="hours-report" onclick="switchAdminTab('hours-report'); return false;">
                    <i class="bi bi-bar-chart"></i> Hours Report
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="leave" onclick="switchAdminTab('leave'); return false;">
                    <i class="bi bi-airplane"></i> Leave
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="fleet" onclick="switchAdminTab('fleet'); return false;">
                    <i class="bi bi-truck"></i> Fleet
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="planning" onclick="switchAdminTab('planning'); return false;">
                    <i class="bi bi-calendar-week"></i> Planning
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="smtp" onclick="switchAdminTab('smtp'); return false;">
                    <i class="bi bi-envelope"></i> SMTP
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="branding" onclick="switchAdminTab('branding'); return false;">
                    <i class="bi bi-palette"></i> Branding
                  </a>
                </li>
              </ul>
              <div id="adminContent"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div class="modal fade" id="addUserModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="addUserAlert"></div>
            <form id="addUserForm">
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Username *</label>
                    <input type="text" class="form-control" id="addUsername" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Password *</label>
                    <input type="password" class="form-control" id="addPassword" required>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Full Name *</label>
                <input type="text" class="form-control" id="addFullName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="addPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Rit Number</label>
                    <input type="text" class="form-control" id="addRitnumber">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Role</label>
                    <select class="form-select" id="addRole">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Truck Type</label>
                    <select class="form-select" id="addMegaKast">
                      <option value="only_mega">Mega Only</option>
                      <option value="mega_and_kast">Mega + Kast</option>
                      <option value="nvt">N.v.t.</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">ADR</label>
                    <select class="form-select" id="addAdr">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Company</label>
                    <select class="form-select" id="addUserCompany">
                      <option value="">No company</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Can Fill In (Invallen)</label>
                    <select class="form-select" id="addCanFillIn" onchange="toggleAddFillInCompany()">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3" id="addFillInCompanyContainer" style="display: none;">
                    <label class="form-label">Fill In Company</label>
                    <select class="form-select" id="addFillInCompany">
                      <option value="">Select company</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddUser()">Create User</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div class="modal fade" id="editUserModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="editUserAlert"></div>
            <form id="editUserForm">
              <input type="hidden" id="editUserId">
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Username</label>
                    <input type="text" class="form-control" id="editUsername" readonly>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Full Name</label>
                    <input type="text" class="form-control" id="editFullName" required>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="editPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Rit Number</label>
                    <input type="text" class="form-control" id="editRitnumber">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Role</label>
                    <select class="form-select" id="editRole">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Truck Type</label>
                    <select class="form-select" id="editMegaKast">
                      <option value="only_mega">Mega Only</option>
                      <option value="mega_and_kast">Mega + Kast</option>
                      <option value="nvt">N.v.t.</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">ADR</label>
                    <select class="form-select" id="editAdr">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Company</label>
                    <select class="form-select" id="editCompany">
                      <option value="">No company</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Can Fill In (Invallen)</label>
                    <select class="form-select" id="editCanFillIn" onchange="toggleEditFillInCompany()">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3" id="editFillInCompanyContainer" style="display: none;">
                    <label class="form-label">Fill In Company</label>
                    <select class="form-select" id="editFillInCompany">
                      <option value="">Select company</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditUser()">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Company Modal -->
    <div class="modal fade" id="addCompanyModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New Company</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="addCompanyAlert"></div>
            <form id="addCompanyForm">
              <div class="mb-3">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" id="addCompanyName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="addCompanyPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">KvK Number</label>
                    <input type="text" class="form-control" id="addCompanyKvk">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">BTW Number</label>
                    <input type="text" class="form-control" id="addCompanyBtw">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Pause Time (HH:MM)</label>
                    <input type="text" class="form-control" id="addCompanyPauseTime" value="00:30">
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Address</label>
                <input type="text" class="form-control" id="addCompanyAddress">
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="addCompanyPostalCode">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="addCompanyCity">
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddCompany()">Create Company</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Company Modal -->
    <div class="modal fade" id="editCompanyModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Company</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="editCompanyAlert"></div>
            <form id="editCompanyForm">
              <input type="hidden" id="editCompanyId">
              <div class="mb-3">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" id="editCompanyName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="editCompanyPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">KvK Number</label>
                    <input type="text" class="form-control" id="editCompanyKvk">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">BTW Number</label>
                    <input type="text" class="form-control" id="editCompanyBtw">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Pause Time (HH:MM)</label>
                    <input type="text" class="form-control" id="editCompanyPauseTime">
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Address</label>
                <input type="text" class="form-control" id="editCompanyAddress">
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="editCompanyPostalCode">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="editCompanyCity">
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditCompany()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========== USERS MANAGEMENT ==========

async function loadAdminUsers() {
  const container = document.getElementById("adminContent");
  if (!container) return;
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';
  
  try {
    allUsers = await api.getUsers();
    renderAdminUsers(allUsers);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

function renderAdminUsers(users) {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="mb-3">
      <button class="btn btn-primary" onclick="showAddUserModal()">
        <i class="bi bi-plus-circle"></i> Add User
      </button>
    </div>
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Full Name</th>
            <th>Company</th>
            <th>Role</th>
            <th>ADR</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.id}</td>
              <td>${user.username}</td>
              <td>${user.full_name}</td>
              <td>${user.company_name || '-'}</td>
              <td><span class="badge bg-info">${user.role || 'user'}</span></td>
              <td>${user.adr ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
              <td>${user.role === 'admin' ? '<span class="badge bg-danger">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
              <td>
                <button class="btn btn-sm btn-warning" onclick="openEditUserModal(${user.id})">
                  <i class="bi bi-pencil"></i> Edit
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ========== COMPANIES MANAGEMENT ==========

async function loadCompaniesManagement() {
  const container = document.getElementById("adminContent");
  if (!container) return;
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';
  
  try {
    allCompanies = await api.getCompanies();
    renderCompaniesManagement(allCompanies);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

function renderCompaniesManagement(companies) {
  const container = document.getElementById("adminContent");
  
  if (!selectedCompanyId && companies.length > 0) {
    selectedCompanyId = companies[0].id;
  }
  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || (companies.length > 0 ? companies[0] : null);
  
  container.innerHTML = `
    <div class="row h-100">
      <div class="col-md-4">
        <div class="card">
          <div class="card-header bg-primary text-white">
            <h6 class="mb-0">Companies</h6>
          </div>
          <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;">
            <div class="list-group list-group-flush">
              ${companies.map(company => `
                <button type="button" class="list-group-item list-group-item-action ${company.id === selectedCompanyId ? 'active' : ''}" 
                        onclick="selectCompany(${company.id})">
                  <strong>${company.name}</strong>
                  <small class="d-block text-muted">${company.city || '-'}</small>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-primary btn-sm w-100" onclick="showAddCompanyModal()">
              <i class="bi bi-plus-circle"></i> Add Company
            </button>
          </div>
        </div>
      </div>
      <div class="col-md-8">
        ${selectedCompany ? `
          <div class="card">
            <div class="card-header bg-secondary text-white">
              <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">${selectedCompany.name}</h6>
                <button class="btn btn-sm btn-warning" onclick="openEditCompanyModal(${selectedCompany.id})">
                  <i class="bi bi-pencil"></i> Edit
                </button>
              </div>
            </div>
            <div class="card-body">
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label text-muted">Company Name</label>
                  <p class="form-control-plaintext"><strong>${selectedCompany.name}</strong></p>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-muted">Phone Number</label>
                  <p class="form-control-plaintext">${selectedCompany.phone || '-'}</p>
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label text-muted">KvK Number</label>
                  <p class="form-control-plaintext">${selectedCompany.kvk || '-'}</p>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-muted">BTW Number</label>
                  <p class="form-control-plaintext">${selectedCompany.btw || '-'}</p>
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-12">
                  <label class="form-label text-muted">Address</label>
                  <p class="form-control-plaintext">${selectedCompany.address || '-'}</p>
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label text-muted">Postal Code</label>
                  <p class="form-control-plaintext">${selectedCompany.postal_code || '-'}</p>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-muted">City</label>
                  <p class="form-control-plaintext">${selectedCompany.city || '-'}</p>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <label class="form-label text-muted">Pause Time</label>
                  <p class="form-control-plaintext"><span class="badge bg-info">${selectedCompany.pause_time || '00:30'}</span></p>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Select a company from the list
          </div>
        `}
      </div>
    </div>
  `;
}

// ========== PLACEHOLDER TABS ==========

let currentSubmissions = [];

async function loadAdminSubmissions() {
  const container = document.getElementById("adminContent");
  if (!container) return;
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';
  
  try {
    currentSubmissions = await api.getAdminSubmissions();
    console.log('[ADMIN] Submissions loaded:', currentSubmissions);
    renderAdminSubmissions(currentSubmissions);
  } catch (error) {
    console.error('[ADMIN] Error loading submissions:', error);
    container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

function renderAdminSubmissions(submissions) {
  const container = document.getElementById("adminContent");
  
  if (!submissions || submissions.length === 0) {
    container.innerHTML = '<div class="alert alert-info">No submissions found</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Company</th>
            <th>Weeknummers</th>
            <th>Total Hours</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map(submission => {
            let weekStr = '-';
            if (submission.week_numbers) {
              const weeks = submission.week_numbers.split(',').map(w => `W${w.trim()}`);
              weekStr = weeks.join(', ');
            }
            
            let submittedStr = '-';
            if (submission.submission_date) {
              submittedStr = new Date(submission.submission_date).toLocaleDateString('nl-NL');
            }
            
            return `
            <tr>
              <td>${submission.id}</td>
              <td>${submission.full_name || submission.username || '-'}</td>
              <td>${submission.company_name || '-'}</td>
              <td>${weekStr}</td>
              <td><strong>${submission.total_hours ? parseFloat(submission.total_hours).toFixed(2) : '0.00'}</strong></td>
              <td>
                <span class="badge ${getSubmissionStatusBadge(submission.status)}">
                  ${submission.status || 'pending'}
                </span>
              </td>
              <td>${submittedStr}</td>
              <td>
                <button class="btn btn-sm btn-info" onclick="viewSubmissionDetails(${submission.id})" title="View details">
                  <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="editSubmissionHours(${submission.id})" title="Edit hours">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="emailSubmission(${submission.id})" title="Send email">
                  <i class="bi bi-envelope"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSubmission(${submission.id})" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate).toLocaleDateString('nl-NL');
  const end = new Date(endDate).toLocaleDateString('nl-NL');
  return `${start} - ${end}`;
}

function getSubmissionStatusBadge(status) {
  switch(status) {
    case 'pending': return 'bg-warning';
    case 'submitted': return 'bg-info';
    case 'approved': return 'bg-success';
    case 'rejected': return 'bg-danger';
    default: return 'bg-secondary';
  }
}

async function viewSubmissionDetails(submissionId) {
  try {
    const timesheets = await api.getSubmissionTimesheets(submissionId);
    showSubmissionModal(submissionId, timesheets);
  } catch (error) {
    alert('Error loading submission details: ' + error.message);
  }
}

function showSubmissionModal(submissionId, timesheets) {
  const submission = currentSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  const modalHtml = `
    <div class="modal fade" id="submissionModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Submission Details - ID ${submission.id}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div class="row mb-4">
              <div class="col-md-3">
                <label class="form-label text-muted">User</label>
                <p class="form-control-plaintext"><strong>${submission.user_name || submission.username || '-'}</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Company</label>
                <p class="form-control-plaintext"><strong>${submission.company_name || '-'}</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Period</label>
                <p class="form-control-plaintext"><strong>${submission.period || formatDateRange(submission.start_date, submission.end_date) || '-'}</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Status</label>
                <p class="form-control-plaintext">
                  <span class="badge ${getSubmissionStatusBadge(submission.status)}">
                    ${submission.status || 'pending'}
                  </span>
                </p>
              </div>
            </div>
            
            <h6 class="mb-3">Timesheets</h6>
            <div class="table-responsive">
              <table class="table table-sm table-striped">
                <thead class="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Break</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${timesheets.map(ts => `
                    <tr>
                      <td>${new Date(ts.date).toLocaleDateString('nl-NL')}</td>
                      <td>${getDayName(ts.date)}</td>
                      <td>${ts.start_time || '-'}</td>
                      <td>${ts.end_time || '-'}</td>
                      <td>${ts.break_duration || '-'}</td>
                      <td>${ts.hours || '-'}</td>
                      <td>${ts.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove old modal if exists
  const oldModal = document.getElementById('submissionModal');
  if (oldModal) oldModal.remove();
  
  // Add and show modal
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('submissionModal')).show();
}

function getDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

async function deleteSubmission(submissionId) {
  if (!confirm('Are you sure you want to delete this submission?')) return;
  
  try {
    await api.deleteSubmission(submissionId);
    alert('Submission deleted successfully');
    loadAdminSubmissions();
  } catch (error) {
    alert('Error deleting submission: ' + error.message);
  }
}

async function editSubmissionHours(submissionId) {
  try {
    const timesheets = await api.getSubmissionTimesheets(submissionId);
    showEditSubmissionModal(submissionId, timesheets);
  } catch (error) {
    alert('Error loading submission: ' + error.message);
  }
}

function showEditSubmissionModal(submissionId, timesheets) {
  const submission = currentSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  const modalHtml = `
    <div class="modal fade" id="editSubmissionModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Submission Hours - ID ${submission.id}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div class="row mb-4">
              <div class="col-md-3">
                <label class="form-label text-muted">User</label>
                <p class="form-control-plaintext"><strong>${submission.full_name || submission.username || '-'}</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Company</label>
                <p class="form-control-plaintext"><strong>${submission.company_name || '-'}</strong></p>
              </div>
              <div class="col-md-6">
                <label class="form-label text-muted">Period</label>
                <p class="form-control-plaintext"><strong>${getSubmissionPeriod(submission)}</strong></p>
              </div>
            </div>
            
            <h6 class="mb-3">Edit Hours</h6>
            <div class="table-responsive">
              <table class="table table-sm table-striped">
                <thead class="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Pause</th>
                    <th>Total Hours</th>
                    <th>Start KM</th>
                    <th>End KM</th>
                    <th>Ritnumber</th>
                  </tr>
                </thead>
                <tbody id="editTimesheetsBody">
                  ${timesheets.map(ts => `
                    <tr>
                      <td>${new Date(ts.date).toLocaleDateString('nl-NL')}</td>
                      <td>${getDayName(ts.date)}</td>
                      <td><input type="time" class="form-control form-control-sm" value="${ts.start_time ?? ''}" data-ts-id="${ts.id}" data-field="startTime"></td>
                      <td><input type="time" class="form-control form-control-sm" value="${ts.end_time ?? ''}" data-ts-id="${ts.id}" data-field="endTime"></td>
                      <td><input type="text" class="form-control form-control-sm" value="${ts.pause_time ?? ts.break_duration ?? ts.pauseTime ?? ''}" data-ts-id="${ts.id}" data-field="pauseTime" placeholder="HH:MM"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${ts.total_hours ?? ts.hours ?? ts.totalHours ?? ''}" data-ts-id="${ts.id}" data-field="totalHours" step="0.25"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${ts.start_km ?? ''}" data-ts-id="${ts.id}" data-field="startKm" step="0.1"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${ts.end_km ?? ''}" data-ts-id="${ts.id}" data-field="endKm" step="0.1"></td>
                      <td><input type="text" class="form-control form-control-sm" value="${ts.ritnumber ?? ''}" data-ts-id="${ts.id}" data-field="ritnumber"></td>
                      <td><input type="hidden" value="${ts.date}" data-ts-id="${ts.id}" data-field="date"></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="saveEditedSubmission(${submissionId})">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const oldModal = document.getElementById('editSubmissionModal');
  if (oldModal) oldModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('editSubmissionModal')).show();
}

async function saveEditedSubmission(submissionId) {
  try {
    const inputs = document.querySelectorAll('#editTimesheetsBody input');
    const updates = {};
    
    inputs.forEach(input => {
      const timesheetId = input.getAttribute('data-ts-id');
      const field = input.getAttribute('data-field');
      const value = input.value;
      
      if (!updates[timesheetId]) {
        updates[timesheetId] = {};
      }
      updates[timesheetId][field] = value;
    });
    
    for (const [timesheetId, data] of Object.entries(updates)) {
      await api.updateAdminTimesheet(timesheetId, data);
    }
    
    alert('Hours updated successfully');
    bootstrap.Modal.getInstance(document.getElementById('editSubmissionModal')).hide();
    loadAdminSubmissions();
  } catch (error) {
    alert('Error saving changes: ' + error.message);
  }
}

function emailSubmission(submissionId) {
  const submission = currentSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  const modalHtml = `
    <div class="modal fade" id="emailSubmissionModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Send Submission Email</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Recipient Email</label>
              <input type="email" class="form-control" id="emailRecipient" value="${submission.email || ''}" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Subject</label>
              <input type="text" class="form-control" id="emailSubject" value="Timesheet Submission - ${submission.full_name || submission.username}">
            </div>
            <div class="mb-3">
              <label class="form-label">Format</label>
              <select class="form-select" id="emailFormat">
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="sendEmailSubmission(${submissionId})">Send Email</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const oldModal = document.getElementById('emailSubmissionModal');
  if (oldModal) oldModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('emailSubmissionModal')).show();
}

async function sendEmailSubmission(submissionId) {
  try {
    const recipient = document.getElementById('emailRecipient').value;
    const format = document.getElementById('emailFormat').value;
    
    if (!recipient) {
      alert('Please enter a recipient email');
      return;
    }
    
    await api.sendCustomSubmissionEmail(submissionId, recipient, format);
    alert('Email sent successfully');
    bootstrap.Modal.getInstance(document.getElementById('emailSubmissionModal')).hide();
  } catch (error) {
    alert('Error sending email: ' + error.message);
  }
}

function getSubmissionPeriod(submission) {
  if (submission.period_start && submission.period_end) {
    const start = new Date(submission.period_start).toLocaleDateString('nl-NL');
    const end = new Date(submission.period_end).toLocaleDateString('nl-NL');
    return `${start} - ${end}`;
  } else if (submission.period) {
    return submission.period;
  }
  return '-';
}

async function loadHoursReport() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">Hours Report</h5>
      <button class="btn btn-sm btn-outline-secondary" id="refreshHoursReport">
        <i class="bi bi-arrow-clockwise"></i> Refresh
      </button>
    </div>
    <div id="hoursReportBody">
      <div class="text-center text-muted py-4">
        <div class="spinner-border" role="status"></div>
        <div class="mt-2">Loading hours report...</div>
      </div>
    </div>
  `;

  document.getElementById('refreshHoursReport').onclick = loadHoursReport;

  try {
    const report = await api.getHoursReport();

    if (!report || report.length === 0) {
      document.getElementById('hoursReportBody').innerHTML = '<div class="alert alert-info">No data found</div>';
      return;
    }

    const rows = report.map(row => `
      <tr>
        <td>${row.full_name || '-'}</td>
        <td>${row.week_number ?? '-'}</td>
        <td>${row.work_days ?? 0}</td>
        <td>${parseFloat(row.total_hours || 0).toFixed(2)}</td>
        <td>${parseFloat(row.overworked || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    document.getElementById('hoursReportBody').innerHTML = `
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th>User</th>
              <th>Week</th>
              <th>Work Days</th>
              <th>Total Hours</th>
              <th>Overworked</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error('[ADMIN] Error loading hours report:', error);
    document.getElementById('hoursReportBody').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

async function loadLeaveManagement() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="row h-100">
      <div class="col-md-4">
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 class="mb-0"><i class="bi bi-people"></i> Gebruikers Verlofsaldo</h6>
            <button class="btn btn-light btn-sm" id="refreshLeaveUsers"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
          <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;" id="leaveUsersWrapper">
            <div class="text-center py-4"><div class="spinner-border"></div></div>
          </div>
        </div>
      </div>
      <div class="col-md-8">
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 class="mb-0"><i class="bi bi-calendar-check"></i> Verlofaanvragen</h6>
            <button class="btn btn-light btn-sm" id="refreshLeaveRequests"><i class="bi bi-arrow-clockwise"></i></button>
          </div>
          <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;" id="leaveRequestsWrapper">
            <div class="text-center py-4"><div class="spinner-border"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('refreshLeaveUsers').onclick = loadLeaveManagement;
  document.getElementById('refreshLeaveRequests').onclick = loadLeaveManagement;

  try {
    // Load users and their leave balances
    const users = await api.getUsers();
    const userRows = users.map(user => `
      <tr>
        <td class="small">${user.full_name || user.username || '-'}</td>
        <td class="text-end small"><span class="badge bg-info">${parseFloat(user.vacation_hours || 0).toFixed(2)} u</span></td>
        <td class="text-end small"><span class="badge bg-success">${parseFloat(user.overtime_hours || 0).toFixed(2)} u</span></td>
      </tr>
    `).join('');

    document.getElementById('leaveUsersWrapper').innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0">
          <thead class="table-light sticky-top">
            <tr>
              <th>Gebruiker</th>
              <th class="text-end">Verlof</th>
              <th class="text-end">Overuren</th>
            </tr>
          </thead>
          <tbody>
            ${userRows}
          </tbody>
        </table>
      </div>
    `;

    // Load leave requests
    const requests = await api.getLeaveRequestsAdmin();

    if (!requests || requests.length === 0) {
      document.getElementById('leaveRequestsWrapper').innerHTML = '<div class="alert alert-info m-3">Geen verlofaanvragen</div>';
    } else {
      const badge = (status) => {
        switch (status) {
          case 'approved': return 'bg-success';
          case 'rejected': return 'bg-danger';
          default: return 'bg-warning text-dark';
        }
      };

      const rows = requests.map(req => {
        const period = `${new Date(req.start_date).toLocaleDateString('nl-NL')} - ${new Date(req.end_date).toLocaleDateString('nl-NL')}`;
        const canAct = req.status === 'pending';

        return `
          <tr>
            <td class="small">${req.full_name || req.username || '-'}</td>
            <td class="small">${req.balance_type === 'overtime' ? 'Overuren' : 'Verlof'}</td>
            <td class="small">${period}</td>
            <td class="text-end small"><strong>${parseFloat(req.hours_requested || 0).toFixed(2)} u</strong></td>
            <td class="text-center"><span class="badge ${badge(req.status)}">${req.status}</span></td>
            <td>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-success btn-sm" ${canAct ? '' : 'disabled'} onclick="adminDecideLeave(${req.id}, 'approved')" title="Goedkeuren"><i class="bi bi-check"></i></button>
                <button class="btn btn-danger btn-sm" ${canAct ? '' : 'disabled'} onclick="adminDecideLeave(${req.id}, 'rejected')" title="Afwijzen"><i class="bi bi-x"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      document.getElementById('leaveRequestsWrapper').innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light sticky-top">
              <tr>
                <th>Gebruiker</th>
                <th>Type</th>
                <th>Periode</th>
                <th class="text-end">Uren</th>
                <th class="text-center">Status</th>
                <th class="text-center">Acties</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (error) {
    console.error('[ADMIN] Error loading leave management:', error);
    document.getElementById('leaveUsersWrapper').innerHTML = `<div class="alert alert-danger m-3">Error: ${error.message}</div>`;
    document.getElementById('leaveRequestsWrapper').innerHTML = `<div class="alert alert-danger m-3">Error: ${error.message}</div>`;
  }
}

window.adminDecideLeave = async function(id, status) {
  try {
    let adminNote = '';
    if (status === 'rejected') {
      adminNote = prompt('Reden voor afwijzing (optioneel):', '') || '';
    }
    await api.decideLeaveRequest(id, status, adminNote);
    loadLeaveManagement();
  } catch (error) {
    alert('Error updating leave request: ' + error.message);
  }
}

async function loadFleetManagement() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="row h-100">
      <div class="col-md-4">
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Fleet</h6>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-light" id="refreshFleet"><i class="bi bi-arrow-clockwise"></i></button>
              <button class="btn btn-success" id="addFleetBtn"><i class="bi bi-plus-circle"></i></button>
            </div>
          </div>
          <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;" id="fleetListWrapper">
            <div class="text-center py-4"><div class="spinner-border"></div></div>
          </div>
        </div>
      </div>
      <div class="col-md-8" id="fleetDetailWrapper">
        <div class="alert alert-info mt-2">Selecteer een voertuig of voeg er een toe.</div>
      </div>
    </div>
  `;

  document.getElementById('refreshFleet').onclick = loadFleetManagement;
  document.getElementById('addFleetBtn').onclick = showAddVehicleModal;

  try {
    const [vehicles, companies] = await Promise.all([
      api.getFleetVehicles(),
      api.getCompanies()
    ]);
    window.companies = companies;
    renderFleetList(vehicles);
  } catch (error) {
    document.getElementById('fleetListWrapper').innerHTML = `<div class="alert alert-danger m-2">Error: ${error.message}</div>`;
  }
}

let fleetVehicles = [];
let fleetMaintenance = [];
let selectedVehicleId = null;
let fleetLoadingId = null;

function renderFleetList(vehicles) {
  fleetVehicles = vehicles || [];
  const wrapper = document.getElementById('fleetListWrapper');
  if (!wrapper) return;

  if (!vehicles || vehicles.length === 0) {
    wrapper.innerHTML = '<div class="p-3 text-muted">Geen voertuigen</div>';
    document.getElementById('fleetDetailWrapper').innerHTML = '<div class="alert alert-info mt-2">Voeg eerst een voertuig toe.</div>';
    return;
  }

  wrapper.innerHTML = `
    <div class="list-group list-group-flush">
      ${vehicles.map(v => `
        <button type="button" class="list-group-item list-group-item-action ${v.id === selectedVehicleId ? 'active' : ''}" onclick="selectVehicle(${v.id})">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${v.license_plate}</strong>
              <small class="d-block text-muted">KM: ${v.km ?? 0} | ${v.company_name || 'Geen bedrijf'}</small>
            </div>
            <span class="badge bg-secondary">APK ${v.apk_due_date ? new Date(v.apk_due_date).toLocaleDateString('nl-NL') : '-'}</span>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  if (selectedVehicleId) {
    selectVehicle(selectedVehicleId);
  } else if (vehicles.length > 0) {
    selectVehicle(vehicles[0].id);
  }
}

async function selectVehicle(id) {
  if (fleetLoadingId === id) return; // Prevent duplicate requests
  fleetLoadingId = id;
  selectedVehicleId = id;
  const detail = document.getElementById('fleetDetailWrapper');
  detail.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>';
  try {
    const data = await api.getFleetVehicle(id);
    if (fleetLoadingId === id) { // Only render if still the current selection
      fleetMaintenance = data.maintenance || []; // Store maintenance records
      renderVehicleDetail(data.vehicle, data.maintenance || []);
      renderFleetList(fleetVehicles); // refresh active state
    }
  } catch (error) {
    if (fleetLoadingId === id) {
      detail.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  } finally {
    if (fleetLoadingId === id) fleetLoadingId = null;
  }
}

function renderVehicleDetail(vehicle, maintenance) {
  const detail = document.getElementById('fleetDetailWrapper');
  if (!vehicle) {
    detail.innerHTML = '<div class="alert alert-info">Selecteer een voertuig</div>';
    return;
  }

  const maintenanceRows = maintenance.length
    ? maintenance.map(m => `
        <tr>
          <td>${new Date(m.maintenance_date).toLocaleDateString('nl-NL')}</td>
          <td>${m.km ?? '-'}</td>
          <td>${m.notes || '-'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-warning me-1" onclick="showEditMaintenanceModal(${m.id}, ${m.vehicle_id})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteMaintenanceRecord(${m.id})"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="text-center text-muted">Geen onderhoud geregistreerd</td></tr>';

  detail.innerHTML = `
    <div class="card">
      <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
        <h6 class="mb-0">${vehicle.license_plate}</h6>
        <button class="btn btn-sm btn-warning" onclick="showEditVehicleModal(${vehicle.id})"><i class="bi bi-pencil"></i> Edit</button>
      </div>
      <div class="card-body">
        <div class="row mb-4">
          <div class="col-md-6">
            <label class="form-label text-muted small">Kenteken</label>
            <p class="form-control-plaintext"><strong>${vehicle.license_plate}</strong></p>
          </div>
          <div class="col-md-6">
            <label class="form-label text-muted small">Rit nummer</label>
            <p class="form-control-plaintext">${vehicle.rit_number || '-'}</p>
          </div>
        </div>
        <div class="row mb-4">
          <div class="col-md-6">
            <label class="form-label text-muted small">KM</label>
            <p class="form-control-plaintext">${vehicle.km ?? 0}</p>
          </div>
          <div class="col-md-6">
            <label class="form-label text-muted small">APK geldig tot</label>
            <p class="form-control-plaintext">${vehicle.apk_due_date ? new Date(vehicle.apk_due_date).toLocaleDateString('nl-NL') : '-'}</p>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0">Onderhoud</h6>
          <button class="btn btn-primary btn-sm" onclick="showAddMaintenanceModal(${vehicle.id})">
            <i class="bi bi-wrench"></i> Nieuw onderhoud
          </button>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-striped">
            <thead class="table-light">
              <tr>
                <th>Datum</th>
                <th>KM</th>
                <th>Toelichting</th>
                <th class="text-end">Acties</th>
              </tr>
            </thead>
            <tbody>
              ${maintenanceRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function showAddVehicleModal() {
  const modalHtml = `
    <div class="modal fade" id="addVehicleModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuw voertuig</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Kenteken</label>
              <input type="text" class="form-control" id="vehicleLicense" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Bedrijf</label>
              <select class="form-select" id="vehicleCompany">
                <option value="">Geen bedrijf</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="vehicleKm" value="0" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">APK geldig tot</label>
              <input type="date" class="form-control" id="vehicleApk">
            </div>
            <div class="mb-3">
              <label class="form-label">Rit nummer</label>
              <input type="text" class="form-control" id="vehicleRit">
            </div>
            <div id="vehicleAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddVehicle()">Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const old = document.getElementById('addVehicleModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Populate companies dropdown
  const companySelect = document.getElementById('vehicleCompany');
  if (window.companies && window.companies.length > 0) {
    window.companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      companySelect.appendChild(opt);
    });
  }
  
  new bootstrap.Modal(document.getElementById('addVehicleModal')).show();
}

async function submitAddVehicle() {
  const license = document.getElementById('vehicleLicense').value.trim();
  if (!license) {
    document.getElementById('vehicleAlert').innerHTML = '<div class="alert alert-danger">Kenteken is verplicht</div>';
    return;
  }
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Opslaan...';
  try {
    await api.createFleetVehicle({
      license_plate: license,
      company_id: document.getElementById('vehicleCompany').value || null,
      km: parseFloat(document.getElementById('vehicleKm').value || '0'),
      apk_due_date: document.getElementById('vehicleApk').value || null,
      rit_number: document.getElementById('vehicleRit').value || null,
    });
    const modal = document.getElementById('addVehicleModal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for modal to close
    await loadFleetManagement();
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    document.getElementById('vehicleAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function showEditVehicleModal(id) {
  const v = fleetVehicles.find(x => x.id === id) || {};
  const modalHtml = `
    <div class="modal fade" id="editVehicleModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bewerk voertuig</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Kenteken</label>
              <input type="text" class="form-control" id="editVehicleLicense" value="${v.license_plate || ''}">
            </div>
            <div class="mb-3">
              <label class="form-label">Bedrijf</label>
              <select class="form-select" id="editVehicleCompany">
                <option value="">Geen bedrijf</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="editVehicleKm" value="${v.km ?? 0}" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">APK geldig tot</label>
              <input type="date" class="form-control" id="editVehicleApk" value="${v.apk_due_date ? v.apk_due_date.slice(0,10) : ''}">
            </div>
            <div class="mb-3">
              <label class="form-label">Rit nummer</label>
              <input type="text" class="form-control" id="editVehicleRit" value="${v.rit_number || ''}">
            </div>
            <div id="editVehicleAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditVehicle(${id})">Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const old = document.getElementById('editVehicleModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Populate companies dropdown
  const companySelect = document.getElementById('editVehicleCompany');
  if (window.companies && window.companies.length > 0) {
    window.companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      opt.selected = c.id === v.company_id;
      companySelect.appendChild(opt);
    });
  }
  
  new bootstrap.Modal(document.getElementById('editVehicleModal')).show();
}

async function submitEditVehicle(id) {
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Opslaan...';
  try {
    await api.updateFleetVehicle(id, {
      license_plate: document.getElementById('editVehicleLicense').value.trim() || null,
      company_id: document.getElementById('editVehicleCompany').value || null,
      km: parseFloat(document.getElementById('editVehicleKm').value || '0'),
      apk_due_date: document.getElementById('editVehicleApk').value || null,
      rit_number: document.getElementById('editVehicleRit').value || null,
    });
    const modal = document.getElementById('editVehicleModal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadFleetManagement();
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    document.getElementById('editVehicleAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function showAddMaintenanceModal(vehicleId) {
  const modalHtml = `
    <div class="modal fade" id="addMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuw onderhoud</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Datum onderhoud</label>
              <input type="date" class="form-control" id="maintDate" required>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="maintKm" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">Toelichting</label>
              <textarea class="form-control" id="maintNotes" rows="3"></textarea>
            </div>
            <div id="maintAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitMaintenance(${vehicleId})">Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const old = document.getElementById('addMaintenanceModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('addMaintenanceModal')).show();
}

async function submitMaintenance(vehicleId) {
  const date = document.getElementById('maintDate').value;
  if (!date) {
    document.getElementById('maintAlert').innerHTML = '<div class="alert alert-danger">Datum is verplicht</div>';
    return;
  }
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Opslaan...';
  try {
    await api.addFleetMaintenance(vehicleId, {
      maintenance_date: date,
      km: parseFloat(document.getElementById('maintKm').value || '0'),
      notes: document.getElementById('maintNotes').value || null,
    });
    const modal = document.getElementById('addMaintenanceModal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
    await new Promise(resolve => setTimeout(resolve, 100));
    await selectVehicle(vehicleId);
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    document.getElementById('maintAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

function showEditMaintenanceModal(maintenanceId, vehicleId) {
  console.log('[FLEET] showEditMaintenanceModal called with ID:', maintenanceId, 'Vehicle ID:', vehicleId);
  console.log('[FLEET] fleetMaintenance array:', fleetMaintenance);
  const maintenance = fleetMaintenance.find(m => m.id === maintenanceId) || {};
  console.log('[FLEET] Found maintenance:', maintenance);
  const modalHtml = `
    <div class="modal fade" id="editMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bewerk onderhoud</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Datum onderhoud</label>
              <input type="date" class="form-control" id="editMaintDate" value="${maintenance.maintenance_date ? maintenance.maintenance_date.slice(0,10) : ''}" required>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="editMaintKm" value="${maintenance.km ?? 0}" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">Toelichting</label>
              <textarea class="form-control" id="editMaintNotes" rows="3">${maintenance.notes || ''}</textarea>
            </div>
            <div id="editMaintAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditMaintenance(${maintenanceId}, ${vehicleId})">Opslaan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const old = document.getElementById('editMaintenanceModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('editMaintenanceModal')).show();
}

async function submitEditMaintenance(maintenanceId, vehicleId) {
  const date = document.getElementById('editMaintDate').value;
  if (!date) {
    document.getElementById('editMaintAlert').innerHTML = '<div class="alert alert-danger">Datum is verplicht</div>';
    return;
  }
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Opslaan...';
  try {
    await api.updateFleetMaintenance(maintenanceId, {
      maintenance_date: date,
      km: parseFloat(document.getElementById('editMaintKm').value || '0'),
      notes: document.getElementById('editMaintNotes').value || null,
    });
    const modal = document.getElementById('editMaintenanceModal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
    await new Promise(resolve => setTimeout(resolve, 100));
    await selectVehicle(vehicleId);
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    document.getElementById('editMaintAlert').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

async function deleteMaintenanceRecord(maintenanceId) {
  console.log('[FLEET] deleteMaintenanceRecord called with ID:', maintenanceId);
  const modalHtml = `
    <div class="modal fade" id="deleteMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">Onderhoud verwijderen</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Weet je zeker dat je dit onderhoudrecord wilt verwijderen? Dit kan niet ongedaan gemaakt worden.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteMaintenance(${maintenanceId})">Verwijderen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const old = document.getElementById('deleteMaintenanceModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('deleteMaintenanceModal')).show();
}

async function confirmDeleteMaintenance(maintenanceId) {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Verwijderen...';
  try {
    await api.deleteFleetMaintenance(maintenanceId);
    // Find the vehicle ID from the current detail
    const vehicleId = selectedVehicleId;
    const modal = document.getElementById('deleteMaintenanceModal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
    await new Promise(resolve => setTimeout(resolve, 100));
    await selectVehicle(vehicleId);
  } catch (error) {
    btn.disabled = false;
    btn.textContent = 'Verwijderen';
    alert(`Error: ${error.message}`);
  }
}

// ========== PLANNING MANAGEMENT ==========
let currentPlanningWeek = null;

function getISOWeekNumber(date = new Date()) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

async function loadPlanningManagement() {
  const container = document.getElementById("adminContent");
  currentPlanningWeek = currentPlanningWeek || getISOWeekNumber();

  container.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
      <div>
        <label class="form-label mb-1">Weeknummer</label>
        <div class="input-group" style="max-width: 240px;">
          <input type="number" min="1" max="53" class="form-control" id="planningWeekInput" value="${currentPlanningWeek}">
          <button class="btn btn-outline-secondary" id="planningWeekRefresh"><i class="bi bi-arrow-clockwise"></i></button>
        </div>
      </div>
      <div>
        <label class="form-label mb-1">Bedrijf (filter)</label>
        <div class="input-group" style="min-width: 280px;">
          <select class="form-select" id="planningCompanyFilter"><option value="">Alle bedrijven</option></select>
          <button class="btn btn-outline-secondary" id="planningGenerateCompanyBtn" title="Voeg alle chauffeurs toe"><i class="bi bi-person-plus"></i></button>
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="planningAddBtn"><i class="bi bi-plus-circle"></i> Nieuwe planning</button>
        <button class="btn btn-outline-secondary" id="planningGenerateBtn"><i class="bi bi-magic"></i> Genereer week</button>
        <button class="btn btn-outline-info" id="planningGenerateVehiclesBtn"><i class="bi bi-truck"></i> Gen. per voertuig</button>
        <button class="btn btn-outline-warning" id="planningClearBtn"><i class="bi bi-trash"></i> Wis week</button>
        <button class="btn btn-outline-success" id="planningPdfBtn"><i class="bi bi-file-earmark-pdf"></i> Export PDF</button>
        <button class="btn btn-outline-info" id="planningEmailBtn"><i class="bi bi-envelope"></i> E-mail PDF</button>
      </div>
    </div>
    <div id="planningList">
      <div class="text-center text-muted py-4">
        <div class="spinner-border" role="status"></div>
        <div class="mt-2">Laden...</div>
      </div>
    </div>
  `;

  document.getElementById('planningWeekRefresh').onclick = () => loadPlanningManagement();
  document.getElementById('planningWeekInput').onchange = async (e) => { currentPlanningWeek = Math.max(1, Math.min(53, parseInt(e.target.value || '1', 10))); await loadPlanningManagement(); };
  document.getElementById('planningAddBtn').onclick = () => showAddPlanningModal();
  document.getElementById('planningGenerateBtn').onclick = () => generatePlanning();
  document.getElementById('planningClearBtn').onclick = () => clearPlanningWeek();
  document.getElementById('planningPdfBtn').onclick = () => exportPlanningPDF();
  document.getElementById('planningEmailBtn').onclick = () => emailPlanningPDF();

  try {
    const companies = await api.getCompanies();
    const filterEl = document.getElementById('planningCompanyFilter');
    if (filterEl) {
      filterEl.innerHTML = '<option value="">Alle bedrijven</option>' + companies.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    }

    const data = await api.getPlanningWeek(currentPlanningWeek);
    renderPlanningList(data);

    if (filterEl) {
      filterEl.onchange = () => {
        const cid = filterEl.value;
        const filtered = cid ? data.filter(d=> String(d.company_id) === String(cid)) : data;
        renderPlanningList(filtered);
      };
    }

    const genCompanyBtn = document.getElementById('planningGenerateCompanyBtn');
    if (genCompanyBtn) {
      genCompanyBtn.onclick = async () => {
        const cid = document.getElementById('planningCompanyFilter').value;
        if (!cid) { alert('Selecteer eerst een bedrijf om alle chauffeurs toe te voegen.'); return; }
        try {
          await api.generateCompanyWeeklyPlanning(currentPlanningWeek, cid);
          await loadPlanningManagement();
        } catch (error) {
          alert('Genereren voor bedrijf mislukt: ' + error.message);
        }
      };
    }

    const genVehiclesBtn = document.getElementById('planningGenerateVehiclesBtn');
    if (genVehiclesBtn) {
      genVehiclesBtn.onclick = showGeneratePlanningByVehiclesModal;
    }
  } catch (error) {
    document.getElementById('planningList').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

function renderPlanningList(entries) {
  const wrapper = document.getElementById('planningList');
  if (!entries || entries.length === 0) {
    wrapper.innerHTML = '<div class="alert alert-info">Geen planning voor deze week.</div>';
    return;
  }

  const dayName = (d) => ({1:'Ma',2:'Di',3:'Wo',4:'Do',5:'Vr'})[d] || d;

  // Sort by day then ritnumber ascending
  const sorted = [...entries].sort((a,b)=>{
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    const ra = (a.route_number || '').toString();
    const rb = (b.route_number || '').toString();
    return ra.localeCompare(rb, 'nl', { numeric: true });
  });

  const rows = sorted.map(e => `
    <tr data-entry-id="${e.id}" data-company-id="${e.company_id}">
      <td>${e.week_number}</td>
      <td>${e.route_number || '-'}</td>
      <td>${dayName(e.day_of_week)}</td>
      <td><select class="form-select form-select-sm" onchange="updatePlanningDriver(${e.id}, ${e.company_id}, this.value)"><option value="${e.driver_id}">${e.driver_name || '-'}</option></select></td>
      <td class="adr-cell">${e.adr ? 'Ja' : 'Nee'}</td>
      <td class="truck-cell">${e.mega_kast === 'mega_and_kast' ? 'Mega+Kast' : (e.mega_kast === 'nvt' ? 'N.v.t.' : 'Mega')}</td>
      <td>${e.license_plate || '-'}</td>
      <td class="phone-cell">${e.phone_number || '-'}</td>
      <td>${e.notes || '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-warning me-1" onclick="showEditPlanningModal(${e.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deletePlanningEntry(${e.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  // Load all company drivers for dropdowns
  (async () => {
    const companyIds = [...new Set(sorted.map(e => e.company_id).filter(Boolean))];
    for (const cid of companyIds) {
      try {
        const drivers = await api.getDriversByCompany(cid);
        const rows = document.querySelectorAll(`tr[data-company-id="${cid}"]`);
        rows.forEach(row => {
          const select = row.querySelector('select');
          const currentDriverId = parseInt(select.value);
          select.innerHTML = drivers.map(d => `<option value="${d.id}" ${d.id === currentDriverId ? 'selected' : ''}>${d.full_name} ${d.ritnumber ? '(' + d.ritnumber + ')' : ''}</option>`).join('');
        });
      } catch (err) {
        console.error('Failed to load drivers for company', cid, err);
      }
    }
  })();

  wrapper.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>Week</th>
            <th>Ritnummer</th>
            <th>Dag</th>
            <th>Chauffeur</th>
            <th>ADR</th>
            <th>Truck</th>
            <th>Kenteken</th>
            <th>Telefoon</th>
            <th>Notities</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function updatePlanningDriver(entryId, companyId, newDriverId) {
  try {
    // Get driver details
    const drivers = await api.getDriversByCompany(companyId);
    const driver = drivers.find(d => d.id === parseInt(newDriverId));
    if (!driver) return;

    // Update backend
    await api.updatePlanningEntry(entryId, {
      driver_id: driver.id,
      adr: driver.adr || false,
      mega_kast: driver.mega_kast || 'only_mega',
      phone_number: driver.phone || ''
    });

    // Update UI cells
    const row = document.querySelector(`tr[data-entry-id="${entryId}"]`);
    if (row) {
      row.querySelector('.adr-cell').textContent = driver.adr ? 'Ja' : 'Nee';
      row.querySelector('.truck-cell').textContent = driver.mega_kast === 'mega_and_kast' ? 'Mega+Kast' : (driver.mega_kast === 'nvt' ? 'N.v.t.' : 'Mega');
      row.querySelector('.phone-cell').textContent = driver.phone || '-';
    }

    showToast('Chauffeur bijgewerkt', 'success');
  } catch (error) {
    showToast('Update mislukt: ' + error.message, 'danger');
  }
}

function showAddPlanningModal() {
  const html = `
    <div class="modal fade" id="addPlanningModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuwe planning (week ${currentPlanningWeek})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Bedrijf</label>
              <select class="form-select" id="plCompany"></select>
            </div>
            <div class="mb-3">
              <label class="form-label">Dag</label>
              <select class="form-select" id="plDay">
                <option value="1">Maandag</option>
                <option value="2">Dinsdag</option>
                <option value="3">Woensdag</option>
                <option value="4">Donderdag</option>
                <option value="5">Vrijdag</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Chauffeur</label>
              <select class="form-select" id="plDriver"><option value="">Selecteer bedrijf eerst</option></select>
            </div>
            <div class="mb-3">
              <label class="form-label">Route nummer</label>
              <input type="text" class="form-control" id="plRoute">
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">ADR</label>
                <select class="form-select" id="plAdr"><option value="0">Nee</option><option value="1">Ja</option></select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Truck</label>
                <select class="form-select" id="plMega">
                  <option value="only_mega">Mega</option>
                  <option value="mega_and_kast">Mega+Kast</option>
                  <option value="nvt">N.v.t.</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Telefoon</label>
              <input type="text" class="form-control" id="plPhone">
            </div>
            <div class="mb-3">
              <label class="form-label">Notities</label>
              <textarea class="form-control" id="plNotes" rows="2"></textarea>
            </div>
            <div id="plAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-primary" onclick="submitAddPlanning()">Opslaan</button>
          </div>
        </div>
      </div>
    </div>`;

  const old = document.getElementById('addPlanningModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  const modalEl = document.getElementById('addPlanningModal');
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();

  (async () => {
    try {
      const companies = await api.getCompanies();
      document.getElementById('plCompany').innerHTML = '<option value="">Selecteer bedrijf</option>' + (companies||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
      document.getElementById('plCompany').onchange = async (e)=>{
        const cid = e.target.value;
        const drivers = cid ? await api.getDriversByCompany(cid) : [];
        document.getElementById('plDriver').innerHTML = (drivers.length? '' : '<option value="">Geen chauffeurs</option>') + drivers.map(d=>`<option value="${d.id}">${d.full_name} ${d.ritnumber? '('+d.ritnumber+')':''}</option>`).join('');
      };
    } catch(err) {
      document.getElementById('plAlert').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  })();
}

async function submitAddPlanning() {
  const alertDiv = document.getElementById('plAlert');
  const weekNumber = currentPlanningWeek;
  const companyId = document.getElementById('plCompany').value;
  const dayOfWeek = parseInt(document.getElementById('plDay').value || '1', 10);
  const driverId = document.getElementById('plDriver').value;
  const routeNumber = document.getElementById('plRoute').value.trim();
  const adr = document.getElementById('plAdr').value === '1';
  const megaKast = document.getElementById('plMega').value;
  const phoneNumber = document.getElementById('plPhone').value.trim();
  const notes = document.getElementById('plNotes').value.trim();

  if (!companyId || !driverId || !routeNumber) {
    alertDiv.innerHTML = '<div class="alert alert-warning">Selecteer bedrijf, chauffeur en vul route in.</div>';
    return;
  }

  try {
    await api.createPlanningEntry({weekNumber, dayOfWeek, routeNumber, driverId: parseInt(driverId,10), vehicleId: null, companyId: parseInt(companyId,10), adr, megaKast, phoneNumber, notes});
    const modal = bootstrap.Modal.getInstance(document.getElementById('addPlanningModal'));
    if (modal) modal.hide();
    await loadPlanningManagement();
  } catch (error) {
    alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
  }
}

async function showEditPlanningModal(id) {
  try {
    const entries = await api.getPlanningWeek(currentPlanningWeek);
    const entry = (entries||[]).find(e => e.id === id);
    if (!entry) return;
    const html = `
      <div class="modal fade" id="editPlanningModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Bewerk planning</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Route nummer</label>
                <input type="text" class="form-control" id="editPlRoute" value="${entry.route_number || ''}">
              </div>
              <div class="mb-3">
                <label class="form-label">Chauffeur</label>
                <select class="form-select" id="editPlDriver"><option value="${entry.driver_id || ''}">${entry.driver_name || '-'}</option></select>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">ADR</label>
                  <select class="form-select" id="editPlAdr"><option value="0" ${entry.adr? '' : 'selected'}>Nee</option><option value="1" ${entry.adr? 'selected':''}>Ja</option></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Truck</label>
                  <select class="form-select" id="editPlMega">
                    <option value="only_mega" ${entry.mega_kast==='only_mega'?'selected':''}>Mega</option>
                    <option value="mega_and_kast" ${entry.mega_kast==='mega_and_kast'?'selected':''}>Mega+Kast</option>
                    <option value="nvt" ${entry.mega_kast==='nvt'?'selected':''}>N.v.t.</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Telefoon</label>
                <input type="text" class="form-control" id="editPlPhone" value="${entry.phone_number || ''}">
              </div>
              <div class="mb-3">
                <label class="form-label">Notities</label>
                <textarea class="form-control" id="editPlNotes" rows="2">${entry.notes || ''}</textarea>
              </div>
              <div id="editPlAlert"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
              <button type="button" class="btn btn-primary" onclick="submitEditPlanning(${entry.id}, ${entry.company_id || 0})">Opslaan</button>
            </div>
          </div>
        </div>
      </div>`;

    const old = document.getElementById('editPlanningModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    const modalEl = document.getElementById('editPlanningModal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    if (entry.company_id) {
      const drivers = await api.getDriversByCompany(entry.company_id);
      document.getElementById('editPlDriver').innerHTML = (drivers||[]).map(d=>`<option value="${d.id}" ${d.id===entry.driver_id?'selected':''}>${d.full_name} ${d.ritnumber? '('+d.ritnumber+')':''}</option>`).join('');
    }
  } catch (error) {
    alert('Kon planning niet laden: ' + error.message);
  }
}

async function submitEditPlanning(id, companyId) {
  const payload = {
    route_number: document.getElementById('editPlRoute').value.trim() || null,
    driver_id: parseInt(document.getElementById('editPlDriver').value || '0', 10) || null,
    adr: document.getElementById('editPlAdr').value === '1',
    mega_kast: document.getElementById('editPlMega').value,
    phone_number: document.getElementById('editPlPhone').value.trim() || null,
    notes: document.getElementById('editPlNotes').value.trim() || null,
  };
  const alertDiv = document.getElementById('editPlAlert');
  try {
    await api.updatePlanningEntry(id, payload);
    const modal = bootstrap.Modal.getInstance(document.getElementById('editPlanningModal'));
    if (modal) modal.hide();
    await loadPlanningManagement();
  } catch (error) {
    alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
  }
}

async function deletePlanningEntry(id) {
  if (!confirm('Weet je zeker dat je deze planning wilt verwijderen?')) return;
  try {
    await api.deletePlanningEntry(id);
    await loadPlanningManagement();
  } catch (error) {
    alert('Verwijderen mislukt: ' + error.message);
  }
}

async function generatePlanning() {
  try {
    await api.generateWeeklyPlanning(currentPlanningWeek);
    await loadPlanningManagement();
  } catch (error) {
    alert('Genereren mislukt: ' + error.message);
  }
}

async function clearPlanningWeek() {
  const companyId = document.getElementById('planningCompanyFilter')?.value;
  if (!companyId) {
    showToast('Selecteer eerst een bedrijf om de planning te wissen', 'warning');
    return;
  }
  if (!confirm('Planning voor dit bedrijf in deze week wissen?')) return;
  try {
    await api.clearWeekPlanning(currentPlanningWeek, companyId);
    await loadPlanningManagement();
    showToast('Planning gewist', 'success');
  } catch (error) {
    showToast('Wissen mislukt: ' + error.message, 'danger');
  }
}

async function exportPlanningPDF() {
  try {
    const blob = await api.exportPlanningPDF(currentPlanningWeek);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-week-${currentPlanningWeek}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    alert('PDF export mislukt: ' + error.message);
  }
}

function emailPlanningPDF() {
  const html = `
    <div class="modal fade" id="emailPlanningModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">E-mail Planning PDF (week ${currentPlanningWeek})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Ontvangers (comma-separated)</label>
              <input type="text" class="form-control" id="plEmailRecipients" placeholder="a@b.nl, c@d.nl">
            </div>
            <div class="mb-3">
              <label class="form-label">Onderwerp</label>
              <input type="text" class="form-control" id="plEmailSubject" value="Weekplanning Week ${currentPlanningWeek}">
            </div>
            <div class="mb-3">
              <label class="form-label">Bericht</label>
              <textarea class="form-control" id="plEmailMessage" rows="3">Beste,\nBijgevoegd de weekplanning.\nMet vriendelijke groet.</textarea>
            </div>
            <div id="plEmailAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-primary" onclick="submitEmailPlanning()">Versturen</button>
          </div>
        </div>
      </div>
    </div>`;
  const old = document.getElementById('emailPlanningModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  new bootstrap.Modal(document.getElementById('emailPlanningModal')).show();
}

async function submitEmailPlanning() {
  const alertDiv = document.getElementById('plEmailAlert');
  const recipientsStr = document.getElementById('plEmailRecipients').value.trim();
  if (!recipientsStr) {
    alertDiv.innerHTML = '<div class="alert alert-warning">Vul minimaal één ontvanger in.</div>';
    return;
  }
  const recipients = recipientsStr.split(',').map(s=>s.trim()).filter(Boolean);
  const subject = document.getElementById('plEmailSubject').value.trim();
  const message = document.getElementById('plEmailMessage').value;
  try {
    await api.emailPlanningPDF(currentPlanningWeek, recipients, subject, message);
    const modal = bootstrap.Modal.getInstance(document.getElementById('emailPlanningModal'));
    if (modal) modal.hide();
    showToast('E-mail verzonden', 'success');
  } catch (error) {
    alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
  }
}

async function loadSMTPSettings() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h5>SMTP Instellingen</h5>
      </div>
      <div class="card-body">
        <div class="alert alert-info">
          <strong>SMTP Configuratie:</strong> Configureer hier de mailserver instellingen voor het versturen van e-mails.
        </div>
        
        <form id="smtpForm">
          <div class="mb-3">
            <label class="form-label">Authenticatietype</label>
            <select class="form-select" id="smtpAuthType">
              <option value="basic">Basic (gebruikersnaam/wachtwoord)</option>
              <option value="oauth2">OAuth2 (Microsoft 365)</option>
            </select>
            <small class="form-text text-muted">Kies het type authenticatie voor je mailserver.</small>
          </div>

          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">SMTP Host</label>
              <input type="text" class="form-control" id="smtpHost" placeholder="smtp.gmail.com">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">SMTP Port</label>
              <input type="number" class="form-control" id="smtpPort" placeholder="587" min="1" max="65535">
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Gebruikersnaam / Email</label>
            <input type="text" class="form-control" id="smtpUser" placeholder="jouw-email@gmail.com">
          </div>

          <div class="mb-3">
            <label class="form-label">Wachtwoord / Token</label>
            <input type="password" class="form-control" id="smtpPass" placeholder="••••••••">
            <small class="form-text text-muted">Voor Gmail: gebruik een App Password. Voor Microsoft 365: gebruik Client Secret.</small>
          </div>

          <div id="oauthSection" style="display:none;">
            <div class="alert alert-warning">
              <strong>OAuth2 Instellingen:</strong> Voer de Microsoft 365 Azure AD gegevens in.
            </div>
            <div class="mb-3">
              <label class="form-label">Tenant ID</label>
              <input type="text" class="form-control" id="oauthTenantId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </div>
            <div class="mb-3">
              <label class="form-label">Client ID</label>
              <input type="text" class="form-control" id="oauthClientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </div>
            <div class="mb-3">
              <label class="form-label">Client Secret</label>
              <input type="password" class="form-control" id="oauthClientSecret" placeholder="••••••••">
            </div>
            <div class="mb-3">
              <label class="form-label">OAuth Scope (optioneel)</label>
              <input type="text" class="form-control" id="oauthScope" placeholder="https://outlook.office365.com/.default" value="https://outlook.office365.com/.default">
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">E-mailadres afzender</label>
            <input type="email" class="form-control" id="emailFrom" placeholder="noreply@bedrijf.nl">
          </div>

          <div class="mb-3">
            <label class="form-label">Standaard ontvanger (CC)</label>
            <input type="email" class="form-control" id="emailTo" placeholder="admin@bedrijf.nl">
          </div>

          <div id="smtpAlert"></div>

          <div class="d-flex gap-2">
            <button type="button" class="btn btn-secondary" onclick="testSMTPConnection()">
              <i class="bi bi-send"></i> Verbinding testen
            </button>
            <button type="button" class="btn btn-primary" onclick="saveSMTPSettings()">
              <i class="bi bi-save"></i> Instellingen opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Load current settings
  try {
    const settings = await api.getSMTPSettings();
    if (settings) {
      document.getElementById('smtpHost').value = settings.smtp_host || '';
      document.getElementById('smtpPort').value = settings.smtp_port || '587';
      document.getElementById('smtpUser').value = settings.smtp_user || '';
      document.getElementById('smtpAuthType').value = settings.auth_type === 'oauth2' ? 'oauth2' : 'basic';
      document.getElementById('emailFrom').value = settings.email_from || '';
      document.getElementById('emailTo').value = settings.email_to || '';
      
      if (settings.auth_type === 'oauth2') {
        document.getElementById('oauthTenantId').value = settings.oauth_tenant_id || '';
        document.getElementById('oauthClientId').value = settings.oauth_client_id || '';
        document.getElementById('oauthScope').value = settings.oauth_scope || 'https://outlook.office365.com/.default';
      }
      
      toggleOAuthFields();
    }
  } catch (error) {
    console.error('Failed to load SMTP settings:', error);
  }

  // Wire auth type change
  document.getElementById('smtpAuthType').onchange = toggleOAuthFields;
}

function toggleOAuthFields() {
  const authType = document.getElementById('smtpAuthType').value;
  document.getElementById('oauthSection').style.display = authType === 'oauth2' ? 'block' : 'none';
}

async function saveSMTPSettings() {
  const alertDiv = document.getElementById('smtpAlert');
  const authType = document.getElementById('smtpAuthType').value;

  const payload = {
    smtp_host: document.getElementById('smtpHost').value.trim(),
    smtp_port: parseInt(document.getElementById('smtpPort').value || '587', 10),
    smtp_user: document.getElementById('smtpUser').value.trim(),
    smtp_pass: document.getElementById('smtpPass').value,
    email_from: document.getElementById('emailFrom').value.trim(),
    email_to: document.getElementById('emailTo').value.trim(),
    auth_type: authType,
  };

  if (authType === 'oauth2') {
    payload.oauth_tenant_id = document.getElementById('oauthTenantId').value.trim();
    payload.oauth_client_id = document.getElementById('oauthClientId').value.trim();
    payload.oauth_client_secret = document.getElementById('oauthClientSecret').value;
    payload.oauth_scope = document.getElementById('oauthScope').value.trim();
  }

  // Validate required fields
  if (!payload.smtp_host || !payload.smtp_user || !payload.email_from) {
    alertDiv.innerHTML = '<div class="alert alert-warning">Vul SMTP Host, Gebruikersnaam en E-mailadres afzender in.</div>';
    return;
  }

  try {
    await api.updateSMTPSettings(payload);
    alertDiv.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle"></i> SMTP instellingen opgeslagen!</div>';
    showToast('SMTP instellingen opgeslagen', 'success');
  } catch (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
  }
}

async function testSMTPConnection() {
  const alertDiv = document.getElementById('smtpAlert');
  alertDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Verbinding testen...</div>';
  
  try {
    const result = await api.testSMTPConnection();
    alertDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle"></i> ${result.message}</div>`;
    showToast('SMTP verbinding OK', 'success');
  } catch (error) {
    alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    showToast('SMTP verbinding mislukt', 'danger');
  }
}

async function loadBrandingSettings() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h5>Branding Instellingen</h5>
      </div>
      <div class="card-body">
        <div class="alert alert-info">
          <strong>Bedrijfsbranding:</strong> Configureer hier het uiterlijk van het systeem met bedrijfskleur, naam en logo.
        </div>
        
        <form id="brandingForm">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">Bedrijfsnaam</label>
              <input type="text" class="form-control" id="brandingCompanyName" placeholder="Uw Bedrijf B.V.">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">Primaire kleur</label>
              <div class="input-group">
                <input type="color" class="form-control form-control-color" id="brandingPrimaryColor" value="#0066CC" title="Kies een kleur">
                <input type="text" class="form-control" id="brandingPrimaryColorText" placeholder="#0066CC" readonly>
              </div>
              <small class="form-text text-muted">Gebruikt voor navigatie, knoppen en accenten.</small>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Tagline / Motto</label>
            <input type="text" class="form-control" id="brandingTagline" placeholder="Bv. 'Efficiënt timesheet management'">
          </div>

          <div class="mb-3">
            <label class="form-label">Logo</label>
            <div class="card bg-light p-3 mb-3">
              <div id="logoPreview" class="text-center">
                <p class="text-muted">Geen logo geupload</p>
              </div>
            </div>
            <input type="file" class="form-control" id="logoFile" accept="image/*">
            <small class="form-text text-muted">Ondersteunde formaten: PNG, JPG, GIF. Max 5MB. Aanbevolen: 200x50px.</small>
          </div>

          <div id="brandingAlert"></div>

          <div class="d-flex gap-2">
            <button type="button" class="btn btn-primary" onclick="saveBrandingSettings()">
              <i class="bi bi-save"></i> Instellingen opslaan
            </button>
            <button type="button" class="btn btn-outline-secondary" onclick="resetBrandingForm()">
              <i class="bi bi-arrow-counterclockwise"></i> Herstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Load current settings
  try {
    const settings = await api.getBrandingSettings();
    if (settings) {
      document.getElementById('brandingCompanyName').value = settings.company_name || '';
      document.getElementById('brandingPrimaryColor').value = settings.primary_color || '#0066CC';
      document.getElementById('brandingPrimaryColorText').value = settings.primary_color || '#0066CC';
      document.getElementById('brandingTagline').value = settings.tagline || '';
      
      if (settings.logo_path) {
        document.getElementById('logoPreview').innerHTML = `<img src="${settings.logo_path}" style="max-height: 100px; max-width: 100%;">`;
      }
    }
  } catch (error) {
    console.error('Failed to load branding settings:', error);
  }

  // Wire color picker change
  document.getElementById('brandingPrimaryColor').onchange = (e) => {
    document.getElementById('brandingPrimaryColorText').value = e.target.value;
  };

  // Wire logo preview
  document.getElementById('logoFile').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('logoPreview').innerHTML = `<img src="${event.target.result}" style="max-height: 100px; max-width: 100%;">`;
      };
      reader.readAsDataURL(file);
    }
  };
}

async function saveBrandingSettings() {
  const alertDiv = document.getElementById('brandingAlert');
  const companyName = document.getElementById('brandingCompanyName').value.trim();
  const primaryColor = document.getElementById('brandingPrimaryColor').value;
  const tagline = document.getElementById('brandingTagline').value.trim();
  const logoFile = document.getElementById('logoFile').files[0];

  // Validate
  if (!companyName) {
    alertDiv.innerHTML = '<div class="alert alert-warning">Vul bedrijfsnaam in.</div>';
    return;
  }

  try {
    console.log('[BRANDING SAVE] Sending:', { company_name: companyName, primary_color: primaryColor, tagline });
    
    // Save basic settings
    const result = await api.updateBrandingSettings({
      company_name: companyName,
      primary_color: primaryColor,
      tagline: tagline
    });

    console.log('[BRANDING SAVE] Response:', result);

    // Upload logo if provided
    if (logoFile) {
      const formData = new FormData();
      formData.append('logo', logoFile);
      await api.uploadBrandingLogo(formData);
    }

    alertDiv.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Branding instellingen opgeslagen!</div>';
    showToast('Branding instellingen opgeslagen', 'success');
    
    // Reload branding to apply changes immediately
    console.log('[BRANDING SAVE] Reloading branding...');
    try {
      app.branding = await api.getPublicBranding();
      console.log('[BRANDING SAVE] Loaded branding:', app.branding);
      app.applyBranding();
      console.log('[BRANDING SAVE] Applied branding');
    } catch (e) {
      console.error('Failed to reload branding:', e);
    }
  } catch (error) {
    console.error('[BRANDING SAVE] Error:', error);
    alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    showToast('Opslaan mislukt', 'danger');
  }
}

async function resetBrandingForm() {
  if (confirm('Formulier herstellen naar opgeslagen waarden?')) {
    await loadBrandingSettings();
  }
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : type === 'warning' ? 'bg-warning' : 'bg-info';
  const iconClass = type === 'success' ? 'bi-check-circle' : type === 'danger' ? 'bi-exclamation-triangle' : type === 'warning' ? 'bi-exclamation-circle' : 'bi-info-circle';
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${iconClass} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
  toast.show();
  
  toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
}

// ========== EXPLICIT EXPORTS TO WINDOW ==========
window.renderAdmin = renderAdmin;
window.initAdmin = initAdmin;
window.switchAdminTab = switchAdminTab;
window.showAddUserModal = showAddUserModal;
window.submitAddUser = submitAddUser;
window.openEditUserModal = openEditUserModal;
window.submitEditUser = submitEditUser;
window.showAddCompanyModal = showAddCompanyModal;
window.submitAddCompany = submitAddCompany;
window.openEditCompanyModal = openEditCompanyModal;
window.submitEditCompany = submitEditCompany;
window.selectCompany = selectCompany;
window.toggleAddFillInCompany = toggleAddFillInCompany;
window.toggleEditFillInCompany = toggleEditFillInCompany;
window.viewSubmissionDetails = viewSubmissionDetails;
window.deleteSubmission = deleteSubmission;
window.editSubmissionHours = editSubmissionHours;
window.emailSubmission = emailSubmission;
window.sendEmailSubmission = sendEmailSubmission;
window.saveEditedSubmission = saveEditedSubmission;
window.loadFleetManagement = loadFleetManagement;
window.selectVehicle = selectVehicle;
window.showAddVehicleModal = showAddVehicleModal;
window.submitAddVehicle = submitAddVehicle;
window.showEditVehicleModal = showEditVehicleModal;
window.submitEditVehicle = submitEditVehicle;
window.showAddMaintenanceModal = showAddMaintenanceModal;
window.submitMaintenance = submitMaintenance;
window.showEditMaintenanceModal = showEditMaintenanceModal;
window.submitEditMaintenance = submitEditMaintenance;
window.deleteMaintenanceRecord = deleteMaintenanceRecord;
window.confirmDeleteMaintenance = confirmDeleteMaintenance;
// Planning exports
window.loadPlanningManagement = loadPlanningManagement;
window.showAddPlanningModal = showAddPlanningModal;
window.submitAddPlanning = submitAddPlanning;
window.showEditPlanningModal = showEditPlanningModal;
window.submitEditPlanning = submitEditPlanning;
window.deletePlanningEntry = deletePlanningEntry;
window.emailPlanningPDF = emailPlanningPDF;
window.submitEmailPlanning = submitEmailPlanning;
window.updatePlanningDriver = updatePlanningDriver;
window.loadSMTPSettings = loadSMTPSettings;
window.saveSMTPSettings = saveSMTPSettings;
window.testSMTPConnection = testSMTPConnection;
window.toggleOAuthFields = toggleOAuthFields;
window.loadBrandingSettings = loadBrandingSettings;
window.saveBrandingSettings = saveBrandingSettings;
window.resetBrandingForm = resetBrandingForm;
window.showGeneratePlanningByVehiclesModal = showGeneratePlanningByVehiclesModal;
/**
 * Show modal to generate planning by vehicles for a specific company
 */
async function showGeneratePlanningByVehiclesModal() {
	console.log('[PLANNING] Opening generate by vehicles modal');
	
	// Create modal HTML
	const modalHTML = `
		<div class="modal fade" id="generateVehiclesModal" tabindex="-1">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Planning per Voertuig Genereren</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
					</div>
					<div class="modal-body">
						<div class="form-group">
							<label for="vehicleGenCompanySelect" class="form-label">Selecteer Bedrijf:</label>
							<select id="vehicleGenCompanySelect" class="form-select">
								<option value="">-- Laden... --</option>
							</select>
						</div>
						<div id="vehicleGenMessage" class="alert d-none" role="alert"></div>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
						<button type="button" class="btn btn-primary" id="vehicleGenSubmitBtn">Genereren</button>
					</div>
				</div>
			</div>
		</div>
	`;
	
	// Remove old modal if exists
	const oldModal = document.getElementById('generateVehiclesModal');
	if (oldModal) oldModal.remove();
	
	// Add new modal to DOM
	document.body.insertAdjacentHTML('beforeend', modalHTML);
	
	// Show modal
  const modal = new bootstrap.Modal(document.getElementById('generateVehiclesModal'));
  modal.show();
	
	// Populate company dropdown - fetch from API
	const companySelect = document.getElementById('vehicleGenCompanySelect');
	companySelect.innerHTML = '<option value="">-- Laden... --</option>';
	
	try {
		// Always fetch companies, don't rely on window.companies
		let companies = window.companies;
		if (!companies || !Array.isArray(companies)) {
			console.log('[PLANNING] Fetching companies from API');
			companies = await api.getCompanies();
			window.companies = companies; // Cache for next time
		}
		
		companySelect.innerHTML = '<option value="">-- Kies een bedrijf --</option>';
		if (companies && companies.length > 0) {
			companies.forEach(company => {
				const option = document.createElement('option');
				option.value = company.id;
				option.textContent = company.name;
				companySelect.appendChild(option);
			});
		} else {
			console.warn('[PLANNING] No companies available');
			companySelect.innerHTML = '<option value="">Geen bedrijven beschikbaar</option>';
		}
	} catch (error) {
		console.error('[PLANNING] Error loading companies:', error);
		companySelect.innerHTML = '<option value="">Fout bij laden bedrijven</option>';
		const messageDiv = document.getElementById('vehicleGenMessage');
		messageDiv.className = 'alert alert-danger d-block';
		messageDiv.textContent = `Fout: ${error.message}`;
	}
	
	// Handle submit button
	document.getElementById('vehicleGenSubmitBtn').onclick = async function() {
		const companyId = document.getElementById('vehicleGenCompanySelect').value;
		const messageDiv = document.getElementById('vehicleGenMessage');
		
		if (!companyId) {
			messageDiv.className = 'alert alert-warning d-block';
			messageDiv.textContent = 'Selecteer alstublieft een bedrijf';
			return;
		}
		
		try {
			console.log(`[PLANNING] Generating planning for company ${companyId}, week ${currentPlanningWeek}`);
			const result = await api.generatePlanningByVehicles(currentPlanningWeek, companyId);
			
			messageDiv.className = 'alert alert-success d-block';
			messageDiv.textContent = `Planning gegenereerd: ${result.totalCreated} entries aangemaakt`;
			
			// Reload planning after 1 second
			setTimeout(() => {
				loadPlanningManagement();
				const modal = bootstrap.Modal.getInstance(document.getElementById('generateVehiclesModal'));
				modal.hide();
			}, 1000);
		} catch (error) {
			console.error('[PLANNING] Error generating planning:', error);
			messageDiv.className = 'alert alert-danger d-block';
			messageDiv.textContent = `Fout: ${error.message || 'Onbekende fout'}`;
		}
	};

}

// Optional exports for direct usage
window.generatePlanning = generatePlanning;
window.clearPlanningWeek = clearPlanningWeek;
window.exportPlanningPDF = exportPlanningPDF;

console.log('[ADMIN] Admin module loaded successfully - all functions exported to window');

// Mark admin as loaded
window.adminModuleReady = true;

})();
