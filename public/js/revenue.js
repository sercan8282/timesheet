// Revenue analytics page
// Uses invoice totals to build weekly/monthly/quarterly revenue chart

function renderRevenue() {
  return `
    <div class="container-fluid mt-4">
      <div class="row mb-4 g-3 align-items-center">
        <div class="col">
          <h2><i class="bi bi-graph-up"></i> <span data-i18n="ui:revenue.title">Omzet</span></h2>
          <div class="text-muted" data-i18n="ui:revenue.subtitle">Overzicht per week / maand / kwartaal op basis van factuur totaalbedragen.</div>
        </div>
        <div class="col-auto d-flex gap-2 align-items-center">
          <select id="revenue-customer" class="form-select" title="Filter op klant">
            <option value="" data-i18n="ui:revenue.all_customers">Alle klanten</option>
          </select>
          <select id="revenue-year" class="form-select" title="Filter op jaar">
            <option value="" data-i18n="ui:revenue.all_years">Alle jaren</option>
          </select>
          <select id="revenue-period" class="form-select" title="Periode">
            <option value="week" data-i18n="ui:revenue.per_week">Per week</option>
            <option value="month" selected data-i18n="ui:revenue.per_month">Per maand</option>
            <option value="quarter" data-i18n="ui:revenue.per_quarter">Per kwartaal</option>
          </select>
          <button class="btn btn-outline-primary" id="revenue-refresh">
            <i class="bi bi-arrow-repeat"></i> <span data-i18n="ui:refresh">Vernieuwen</span>
          </button>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <canvas id="revenue-chart" height="120"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h5><span data-i18n="ui:summary">Samenvatting</span></h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-sm align-middle">
              <thead id="revenue-table-head"></thead>
              <tbody id="revenue-table-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initRevenue() {
  const periodSelect = document.getElementById("revenue-period");
  const refreshBtn = document.getElementById("revenue-refresh");
  const customerSelect = document.getElementById("revenue-customer");
  const yearSelect = document.getElementById("revenue-year");
  let cachedInvoices = [];

  const load = async () => {
    try {
      cachedInvoices = await api.getInvoices();
      populateCustomers(customerSelect, cachedInvoices || []);
      populateYears(yearSelect, cachedInvoices || []);
      buildRevenue(
        periodSelect.value,
        customerSelect.value,
        yearSelect.value,
        cachedInvoices || []
      );
    } catch (err) {
      console.error("Error loading invoices for revenue:", err);
      const errorMsg =
        window.app && window.app.t
          ? window.app.t("ui", "revenue.error_loading")
          : "Error loading revenue data";
      showToast(errorMsg || "Error loading revenue data", "error");
    }
  };

  periodSelect.onchange = () =>
    buildRevenue(
      periodSelect.value,
      customerSelect.value,
      yearSelect.value,
      cachedInvoices || []
    );
  customerSelect.onchange = () =>
    buildRevenue(
      periodSelect.value,
      customerSelect.value,
      yearSelect.value,
      cachedInvoices || []
    );
  yearSelect.onchange = () =>
    buildRevenue(
      periodSelect.value,
      customerSelect.value,
      yearSelect.value,
      cachedInvoices || []
    );
  refreshBtn.onclick = load;
  load();
}

let revenueChart;

function buildRevenue(period, customerFilter, yearFilter, invoices) {
  if (revenueChart) {
    revenueChart.destroy();
  }

  const filtered = filterByYear(
    yearFilter,
    filterByCustomer(customerFilter, invoices)
  );
  
  // Separate invoices by type: Verkoop (income) and Inkoop (expenses)
  const { incomeByYear, expensesByYear, labelSet } = aggregateRevenueByType(period, filtered);
  const years = new Set([...Object.keys(incomeByYear), ...Object.keys(expensesByYear)]);
  const yearsList = Array.from(years).sort();
  const labels = Array.from(labelSet).sort();

  // If a specific year is selected, limit to that
  const yearsForChart = yearFilter
    ? yearsList.filter((y) => y === yearFilter)
    : yearsList;

  // Create datasets for income and expenses per year
  const datasets = [];
  
  yearsForChart.forEach((year, idx) => {
    // Income dataset (green)
    const incomeColor = `hsla(120, 60%, ${45 - idx * 5}%, 0.8)`;
    datasets.push({
      label: `Inkomsten ${year}`,
      data: labels.map((lbl) =>
        Number((incomeByYear[year]?.[lbl] || 0).toFixed(2))
      ),
      borderColor: incomeColor,
      backgroundColor: incomeColor,
      borderWidth: 2,
      tension: 0.1,
      fill: false,
    });

    // Expenses dataset (red)
    const expenseColor = `hsla(0, 60%, ${45 - idx * 5}%, 0.8)`;
    datasets.push({
      label: `Uitgaven ${year}`,
      data: labels.map((lbl) =>
        Number((expensesByYear[year]?.[lbl] || 0).toFixed(2))
      ),
      borderColor: expenseColor,
      backgroundColor: expenseColor,
      borderWidth: 2,
      tension: 0.1,
      fill: false,
    });
  });

  const ctx = document.getElementById("revenue-chart");
  revenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: (val) => `€ ${Number(val).toFixed(0)}`,
          },
          beginAtZero: true,
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: € ${ctx.parsed.y.toFixed(2)}`,
          },
        },
        legend: {
          display: true,
          position: 'top',
        },
      },
    },
  });

  renderTable(labels, yearsForChart, incomeByYear, expensesByYear);
}

function aggregateRevenueByType(period, invoices) {
  const incomeByYear = {}; // year -> { label -> sum }
  const expensesByYear = {}; // year -> { label -> sum }
  const labelSet = new Set();
  
  invoices.forEach((inv) => {
    if (!inv.invoice_date || inv.total_amount == null) return;
    const amount = parseFloat(inv.total_amount) || 0;
    const d = new Date(inv.invoice_date);
    if (Number.isNaN(d.getTime())) return;

    let key;
    if (period === "week") {
      const { week } = isoWeek(d);
      key = `W${String(week).padStart(2, "0")}`;
    } else if (period === "quarter") {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      key = `Q${quarter}`;
    } else {
      // month
      const month = d.getMonth() + 1;
      key = `${String(month).padStart(2, "0")}`;
    }

    const year = d.getFullYear().toString();
    const invoiceType = inv.invoice_type || 'Verkoop'; // Default to Verkoop for old invoices
    
    if (invoiceType === 'Verkoop') {
      // Income
      if (!incomeByYear[year]) incomeByYear[year] = {};
      incomeByYear[year][key] = (incomeByYear[year][key] || 0) + amount;
    } else if (invoiceType === 'Inkoop') {
      // Expenses
      if (!expensesByYear[year]) expensesByYear[year] = {};
      expensesByYear[year][key] = (expensesByYear[year][key] || 0) + amount;
    }
    
    labelSet.add(key);
  });
  
  return { incomeByYear, expensesByYear, labelSet };
}

function filterByCustomer(customerFilter, invoices) {
  if (!customerFilter) return invoices;
  const target = customerFilter.trim().toLowerCase();
  return invoices.filter(
    (inv) => (inv.customer_name || "").trim().toLowerCase() === target
  );
}

function filterByYear(yearFilter, invoices) {
  if (!yearFilter) return invoices;
  return invoices.filter((inv) => {
    if (!inv.invoice_date) return false;
    const d = new Date(inv.invoice_date);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear().toString() === yearFilter;
  });
}

function populateCustomers(selectEl, invoices) {
  if (!selectEl) return;
  const names = new Set();
  invoices.forEach((inv) => {
    const name = (inv.customer_name || "").trim();
    if (name) names.add(name);
  });

  const current = selectEl.value;
  selectEl.innerHTML =
    '<option value="">Alle klanten</option>' +
    Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((n) => `<option value="${n}">${n}</option>`)
      .join("");

  // Restore selection if still present
  const hasCurrent = Array.from(selectEl.options).some(
    (opt) => opt.value === current
  );
  selectEl.value = hasCurrent ? current : "";
}

function populateYears(selectEl, invoices) {
  if (!selectEl) return;
  const years = new Set();
  invoices.forEach((inv) => {
    if (!inv.invoice_date) return;
    const d = new Date(inv.invoice_date);
    if (Number.isNaN(d.getTime())) return;
    years.add(d.getFullYear().toString());
  });

  const current = selectEl.value;
  selectEl.innerHTML =
    '<option value="">Alle jaren</option>' +
    Array.from(years)
      .sort()
      .map((y) => `<option value="${y}">${y}</option>`)
      .join("");

  const hasCurrent = Array.from(selectEl.options).some(
    (opt) => opt.value === current
  );
  selectEl.value = hasCurrent ? current : "";
}

function renderTable(labels, years, incomeByYear, expensesByYear) {
  const thead = document.getElementById("revenue-table-head");
  const tbody = document.getElementById("revenue-table-body");
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Periode</th>
      ${years
        .map(
          (y) => `
        <th class="text-end text-success">Inkomsten ${y}</th>
        <th class="text-end text-danger">Uitgaven ${y}</th>
        <th class="text-end fw-bold">Winst/Verlies ${y}</th>
      `
        )
        .join("")}
    </tr>
  `;

  let totalIncome = 0;
  let totalExpenses = 0;

  tbody.innerHTML = labels
    .map((label) => {
      const cells = years
        .map((y) => {
          const income = incomeByYear[y]?.[label] || 0;
          const expense = expensesByYear[y]?.[label] || 0;
          const profit = income - expense;

          totalIncome += income;
          totalExpenses += expense;

          return `
          <td class="text-end text-success">€ ${income.toFixed(2)}</td>
          <td class="text-end text-danger">€ ${expense.toFixed(2)}</td>
          <td class="text-end fw-bold ${
            profit >= 0 ? "text-success" : "text-danger"
          }">€ ${profit.toFixed(2)}</td>
        `;
        })
        .join("");
      return `<tr><td>${label}</td>${cells}</tr>`;
    })
    .join("");

  const totalProfit = totalIncome - totalExpenses;
  updateProfitSummary(totalIncome, totalExpenses, totalProfit);
}

function updateProfitSummary(totalIncome, totalExpenses, totalProfit) {
  let summaryDiv = document.getElementById("profit-summary");

  if (!summaryDiv) {
    // Create summary section if it doesn't exist
    const tableWrapper = document.getElementById("revenue-table-wrapper");
    if (tableWrapper) {
      summaryDiv = document.createElement("div");
      summaryDiv.id = "profit-summary";
      summaryDiv.className = "mt-4 mb-4";
      tableWrapper.parentNode.insertBefore(summaryDiv, tableWrapper);
    } else {
      return;
    }
  }

  const profitClass = totalProfit >= 0 ? "text-success" : "text-danger";
  const profitIcon = totalProfit >= 0 ? "📈" : "📉";

  summaryDiv.innerHTML = `
    <h5 class="mb-3">Financieel Overzicht</h5>
    <div class="row text-center">
      <div class="col-md-4">
        <div class="card bg-success bg-opacity-10 border-success">
          <div class="card-body">
            <h6 class="text-success mb-1">Totale Inkomsten</h6>
            <h4 class="text-success mb-0">€ ${totalIncome.toFixed(2)}</h4>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-danger bg-opacity-10 border-danger">
          <div class="card-body">
            <h6 class="text-danger mb-1">Totale Uitgaven</h6>
            <h4 class="text-danger mb-0">€ ${totalExpenses.toFixed(2)}</h4>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card ${profitClass} bg-opacity-10 border-${
    totalProfit >= 0 ? "success" : "danger"
  }">
          <div class="card-body">
            <h6 class="${profitClass} mb-1">${
    totalProfit >= 0 ? "Winst" : "Verlies"
  } ${profitIcon}</h6>
            <h4 class="${profitClass} mb-0">€ ${totalProfit.toFixed(2)}</h4>
          </div>
        </div>
      </div>
    </div>
  `;
}

function isoWeek(date) {
  const tmp = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week: weekNum };
}

window.renderRevenue = renderRevenue;
window.initRevenue = initRevenue;
