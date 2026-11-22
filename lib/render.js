import { amountOwed, invoiceStatus } from "./status.js";
import { reminderText, whatsappLink, chaseFirst, chaseReason, payHistoryNote } from "./alerts.js";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Header date from an ISO "YYYY-MM-DD" string, e.g. "Sun, 22 Nov 2026". UTC so time zones cannot shift the day.
export function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

// Screen heading, with the "Sample data" pill when the screen shows sample data.
function heading(title, withSample) {
  const pill = withSample ? ' <span class="pill">Sample data</span>' : "";
  return `<h1>${escapeHtml(title)}${pill}</h1>`;
}

function emptyState(message) {
  return `<div class="empty"><p>${escapeHtml(message)}</p></div>`;
}

export function renderScreen(page, withSample = false) {
  return `<section>${heading(page.title, withSample)}</section>`;
}

export function renderStudents(list) {
  if (list.length === 0) {
    return `<section>${emptyState("No students yet. Students you add will show here.")}</section>`;
  }
  const rows = list
    .map(
      (s) =>
        `<li>${escapeHtml(s.name)} | Parent: ${escapeHtml(s.parentName)} | Phone: ${escapeHtml(s.parentPhone)} | Monthly fee: Rs ${escapeHtml(s.monthlyFee)} | Due day: ${escapeHtml(s.dueDay)}</li>`
    )
    .join("");
  return `<section><ul>${rows}</ul></section>`;
}

// Class names for the coloured status pill: red Overdue, amber Partly paid, green Paid, neutral Sent.
const STATUS_CLASS = {
  Overdue: "status-overdue",
  "Partly paid": "status-partly",
  Paid: "status-paid",
  Sent: "status-sent",
};

export function renderInvoices(invoiceList, studentList, paymentList, today) {
  const nameOf = (id) => {
    const student = studentList.find((s) => s.id === id);
    return student ? student.name : id;
  };
  const rows = invoiceList
    .map((inv) => {
      const status = invoiceStatus(inv, paymentList, today);
      return `<tr><td data-label="Student">${escapeHtml(nameOf(inv.studentId))}</td><td data-label="Month">${escapeHtml(inv.month)}</td><td data-label="Amount">Rs ${escapeHtml(inv.amount)}</td><td data-label="Due date">${escapeHtml(inv.dueDate)}</td><td data-label="Status"><span class="status ${STATUS_CLASS[status] ?? "status-sent"}">${escapeHtml(status)}</span></td><td data-label="Owed">Rs ${escapeHtml(amountOwed(inv, paymentList))}</td></tr>`;
    })
    .join("");
  const table = invoiceList.length
    ? `<table><thead><tr><th>Student</th><th>Month</th><th>Amount</th><th>Due date</th><th>Status</th><th>Owed</th></tr></thead><tbody>${rows}</tbody></table>`
    : emptyState("No invoices yet. Create one below.");
  const invoiceOptions = invoiceList
    .map(
      (inv) =>
        `<option value="${escapeHtml(inv.id)}">${escapeHtml(nameOf(inv.studentId))} | ${escapeHtml(inv.month)} | owed Rs ${escapeHtml(amountOwed(inv, paymentList))}</option>`
    )
    .join("");
  const studentOptions = studentList
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
    .join("");
  const paymentRows = paymentList
    .map((p) => {
      const inv = invoiceList.find((i) => i.id === p.invoiceId);
      const who = inv ? nameOf(inv.studentId) : p.invoiceId;
      return `<li>${escapeHtml(p.date)} | ${escapeHtml(who)} | Rs ${escapeHtml(p.amount)}</li>`;
    })
    .join("");
  const payments = `<h2>Payments</h2>${
    paymentRows ? `<ul>${paymentRows}</ul>` : emptyState("No payments yet. Use Record payment to add one.")
  }`;
  return `<section>
${heading("Invoices", true)}
${table}
<div class="actions"><button type="button" data-toggle="payment-form">Record payment</button> <button type="button" data-toggle="invoice-form">Create invoice</button></div>
<form id="payment-form" hidden>
<label>Invoice <select name="invoiceId" required>${invoiceOptions}</select></label>
<label>Amount <input name="amount" type="number" min="1" step="any" required></label>
<label>Date <input name="date" type="date" value="${escapeHtml(today)}" required></label>
<label>Method <select name="method"><option value="UPI">UPI</option><option value="cash">cash</option></select></label>
<button type="submit">Save payment</button>
</form>
<form id="invoice-form" hidden>
<label>Student <select name="studentId" required>${studentOptions}</select></label>
<label>Month <select name="month" required><option value="2026-10">Oct 2026</option><option value="2026-11">Nov 2026</option><option value="2026-12">Dec 2026</option><option value="2027-01">Jan 2027</option></select></label>
<button type="submit">Save invoice</button>
</form>
${payments}
</section>`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days from one ISO date ("YYYY-MM-DD") to another, using UTC so time zones cannot shift the count.
function daysBetween(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

function formatRupees(amount) {
  return `Rs ${Number(amount).toLocaleString("en-IN")}`;
}

const QUICK_HINT = "Aarav paid 1000 UPI yesterday";

// Friendly sentence for each quick entry error code.
const QUICK_MESSAGES = {
  notFound: "I couldn't find a student called that. Try the first name.",
  ambiguous: "More than one student has that first name. Pick one:",
  noAmount: "I couldn't find the amount. Include a number, like 1000.",
  noMethod: "Say whether it was paid by UPI or cash.",
  noInvoice: "That student has no unpaid invoice to record this against.",
  badDate: "That date isn't valid. Try 21 Nov or 2026-11-21.",
  overpaid: "That is more than is still owed on the invoice. Check the amount.",
};

// "2026-11-21" -> "21 Nov"
function shortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

// Quick entry box at the top of the Dashboard. quick = { text, pending, error, options } from lib/app.js.
function quickEntryBlock(quick) {
  const q = quick ?? { text: "", pending: null, error: null, options: [] };
  const hint = escapeHtml(QUICK_HINT);
  const form = `<form id="quick-entry-form" class="quick-entry">
<label>Quick entry <input name="text" type="text" value="${escapeHtml(q.text)}" placeholder="${hint}" autocomplete="off"></label>
<button type="submit" class="button small">Review</button>
</form>`;
  let message = "";
  if (q.error) {
    const text = QUICK_MESSAGES[q.error] ?? "I couldn't record that. Try again.";
    const picks =
      q.error === "ambiguous"
        ? `<div class="actions">${q.options
            .map(
              (name) =>
                `<button type="button" data-action="quick-pick" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
            )
            .join(" ")}</div>`
        : "";
    message = `<p class="quick-message" role="alert">${escapeHtml(text)}</p>${picks}`;
  }
  let preview = "";
  if (q.pending) {
    const p = q.pending;
    preview = `<div class="quick-preview" role="alert">
<p>Record Rs ${escapeHtml(p.amount)} ${escapeHtml(p.method)} from ${escapeHtml(p.studentName)} on ${escapeHtml(shortDate(p.date))}?</p>
<div class="actions"><button type="button" data-action="quick-confirm">Confirm</button> <button type="button" data-action="quick-cancel">Cancel</button></div>
</div>`;
  }
  return `<div class="quick-box">
${form}
${message}
${preview}
</div>`;
}

// Round badge text: first letter of the first two words of a name, e.g. "Aarav Kumar" -> "AK".
function initials(name) {
  const letters = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return letters || "?";
}

// "Chase first today" card: top overdue invoices by amount owed x days late. Remind opens the same drafted reminder as Alerts.
// reminderLog is an array of { date, invoiceId, parentName, amount, tone }; a row shows "Reminded today" when it has an entry for its invoice dated today.
function chaseCard(invoiceList, studentList, paymentList, today, reminderLog, parentAvgDaysLate) {
  const items = chaseFirst(invoiceList, paymentList, studentList, today, parentAvgDaysLate, 3);
  const rows = items
    .map((item) => {
      const reminded = reminderLog.some((r) => r.invoiceId === item.invoiceId && r.date === today);
      const action = reminded
        ? '<span class="status status-paid">Reminded today</span>'
        : `<a class="button small" target="_blank" rel="noopener" href="${escapeHtml(whatsappLink(item.parentPhone, reminderText(item)))}" data-action="log-reminder" data-invoice-id="${escapeHtml(item.invoiceId)}">Remind</a>`;
      const note = payHistoryNote(item);
      return `<li class="chase-row"><span class="avatar" aria-hidden="true">${escapeHtml(initials(item.studentName))}</span><div class="chase-main"><strong>${escapeHtml(item.studentName)}</strong><p>${escapeHtml(note)}</p></div><span class="chase-amount">${formatRupees(item.amountOwed)}</span><span class="chip chip-red">${escapeHtml(item.daysLate)} days late</span>${action}</li>`;
    })
    .join("");
  const body = items.length ? `<ul>${rows}</ul>` : emptyState("No overdue invoices. Nothing to chase today.");
  return `<div class="quick-box chase-card">
<h2>Chase first today</h2>
${body}
</div>`;
}

export function renderDashboard(
  invoiceList,
  studentList,
  paymentList,
  today,
  quick = null,
  reminderLog = [],
  parentAvgDaysLate = {},
  lowestCash30 = null
) {
  const nameOf = (id) => {
    const student = studentList.find((s) => s.id === id);
    return student ? student.name : id;
  };
  const total = invoiceList.reduce((sum, inv) => sum + amountOwed(inv, paymentList), 0);
  const overdue = invoiceList
    .filter((inv) => invoiceStatus(inv, paymentList, today) === "Overdue")
    .map((inv) => ({ inv, daysLate: daysBetween(inv.dueDate, today) }))
    .sort((a, b) => b.daysLate - a.daysLate);
  const groups = [
    { heading: "1-7 days late", inGroup: (d) => d >= 1 && d <= 7 },
    { heading: "8-15 days late", inGroup: (d) => d >= 8 && d <= 15 },
    { heading: "16+ days late", inGroup: (d) => d >= 16 },
  ];
  const sections = groups
    .map((group) => {
      const rows = overdue
        .filter((o) => group.inGroup(o.daysLate))
        .map(
          (o) =>
            `<li>${escapeHtml(nameOf(o.inv.studentId))} | owed ${formatRupees(amountOwed(o.inv, paymentList))} | ${o.daysLate} days late</li>`
        )
        .join("");
      return rows ? `<div class="ageing-group"><h2>${group.heading}</h2><ul>${rows}</ul></div>` : "";
    })
    .join("");
  const overdueBlock = overdue.length
    ? `<div class="ageing-groups">${sections}</div>`
    : emptyState("No overdue invoices. Nice work!");
  const cashTile = lowestCash30 ? formatRupees(lowestCash30.balance) : "No data";
  const summary = `<div class="summary-strip">
<div class="summary-tile"><p class="tile-label">Total outstanding</p><p class="tile-value">${formatRupees(total)}</p></div>
<div class="summary-tile"><p class="tile-label">Number overdue</p><p class="tile-value">${overdue.length}</p></div>
<div class="summary-tile"><p class="tile-label">Lowest cash in the next 30 days</p><p class="tile-value">${cashTile}</p></div>
</div>`;
  return `<section>
${heading("Dashboard", true)}
${summary}
${quickEntryBlock(quick)}
${chaseCard(invoiceList, studentList, paymentList, today, reminderLog, parentAvgDaysLate)}
<h2>Overdue invoices</h2>
${overdueBlock}
<div class="actions"><button type="button" data-action="reset-demo">Reset demo</button></div>
</section>`;
}

export function renderBills(billList) {
  const frequencyLabel = (f) => (f === "monthly" ? "Monthly" : "One-off");
  const rows = billList
    .map(
      (b) =>
        `<tr><td data-label="Name">${escapeHtml(b.name)}</td><td data-label="Amount">${formatRupees(b.amount)}</td><td data-label="Due date">${escapeHtml(b.dueDate)}</td><td data-label="Frequency">${frequencyLabel(b.frequency)}</td></tr>`
    )
    .join("");
  const table = billList.length
    ? `<table><thead><tr><th>Name</th><th>Amount</th><th>Due date</th><th>Frequency</th></tr></thead><tbody>${rows}</tbody></table>`
    : emptyState("No bills yet. Add one below.");
  return `<section>
${heading("Bills", true)}
${table}
<form id="bill-form">
<label>Name <input name="name" type="text" required></label>
<label>Amount <input name="amount" type="number" min="1" step="any" required></label>
<label>Due date <input name="dueDate" type="date" required></label>
<label>Frequency <select name="frequency" required><option value="monthly">Monthly</option><option value="oneoff">One-off</option></select></label>
<button type="submit">Add bill</button>
</form>
</section>`;
}

// One-tap Forecast presets, in button order. Names match presetWhatIf in lib/forecast.js.
const PRESETS = [
  { name: "key15", label: "Key parent 15 days late" },
  { name: "leave3", label: "3 students leave from next month" },
  { name: "summer", label: "Summer break: no new invoices for 2 months" },
  { name: "hike200", label: "Rs 200 fee hike from next month" },
];

// Forecast screen. state = { horizonDays, whatIf: { mode, studentId, days, count }, activePreset, students }.
// view = { normal, whatIf, lowestChange } where normal and whatIf are forecast() results.
export function renderForecast(state, view) {
  const { horizonDays, whatIf, activePreset = null, students } = state;
  const { normal, whatIf: alt, lowestChange } = view;
  const horizonButtons = [30, 60, 90]
    .map((d) => `<button type="button" data-horizon="${d}" aria-pressed="${d === horizonDays}">${d} days</button>`)
    .join(" ");
  const presetButtons = PRESETS.map(
    (p) =>
      `<button type="button" data-action="preset" data-preset="${p.name}" aria-pressed="${p.name === activePreset}">${escapeHtml(p.label)}</button>`
  ).join(" ");
  const parentOptions = students
    .map(
      (s) =>
        `<option value="${escapeHtml(s.id)}"${s.id === whatIf.studentId ? " selected" : ""}>${escapeHtml(s.parentName)}</option>`
    )
    .join("");
  const sign = lowestChange > 0 ? "+" : lowestChange < 0 ? "-" : "";
  return `<section>
<h1>Forecast</h1>
<div class="actions">${horizonButtons}</div>
<div class="actions">${presetButtons}</div>
${forecastChart(normal.daily, alt.daily, normal.lowest)}
<p>Solid teal line: normal. Dashed red line: what-if.</p>
<p>Lowest balance: ${formatRupees(normal.lowest.balance)} on ${escapeHtml(normal.lowest.date)}</p>
<p>First date below zero: ${escapeHtml(normal.firstNegative ?? "None")}</p>
<form id="whatif-form">
<label>Scenario <select name="mode"><option value="late"${whatIf.mode === "late" ? " selected" : ""}>Parent late by N days</option><option value="leave"${whatIf.mode === "leave" ? " selected" : ""}>Students leave</option></select></label>
<label>Parent <select name="studentId">${parentOptions}</select></label>
<label>Days late <input name="days" type="number" min="0" max="365" step="1" value="${escapeHtml(whatIf.days)}"></label>
<label>Students leaving <input name="count" type="number" min="0" max="${students.length}" step="1" value="${escapeHtml(whatIf.count)}"></label>
<button type="submit">Apply</button>
</form>
<p>What-if lowest balance: ${formatRupees(alt.lowest.balance)}</p>
<p>Change in lowest balance: ${sign}${formatRupees(Math.abs(lowestChange))}</p>
</section>`;
}

// Inline SVG line chart. Solid teal line = normal, dashed red line = what-if, dot = lowest point of the normal line. Zero line included.
function forecastChart(normalDaily, whatIfDaily, lowest) {
  const W = 600;
  const H = 240;
  const PAD = 30;
  const balances = [...normalDaily, ...whatIfDaily].map((d) => d.balance).concat([0]);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  const n = normalDaily.length;
  const x = (i) => PAD + (n > 1 ? (i / (n - 1)) * (W - 2 * PAD) : 0);
  const y = (b) => PAD + (1 - (b - min) / span) * (H - 2 * PAD);
  const points = (daily) => daily.map((d, i) => `${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(" ");
  const lowestIndex = Math.max(0, normalDaily.findIndex((d) => d.date === lowest.date));
  const cx = x(lowestIndex).toFixed(1);
  const cy = y(lowest.balance).toFixed(1);
  const labelY = Math.max(12, Number(cy) - 10).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Balance forecast chart">
<line x1="${PAD}" y1="${y(0).toFixed(1)}" x2="${W - PAD}" y2="${y(0).toFixed(1)}" stroke="#888" stroke-width="1"/>
<polyline points="${points(normalDaily)}" fill="none" stroke="#0f766e" stroke-width="2"/>
<polyline points="${points(whatIfDaily)}" fill="none" stroke="#c62828" stroke-width="2" stroke-dasharray="6 4"/>
<circle cx="${cx}" cy="${cy}" r="5" fill="#0f766e"/>
<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="12">Lowest ${formatRupees(lowest.balance)} on ${escapeHtml(lowest.date)}</text>
</svg>`;
}

// Alerts screen. alertsData is a flat array of alerts from lib/alerts.js (type overdue, cash or bill).
// reminderLog is an array of { date, parentName, amount, tone }.
export function renderAlerts(alertsData, reminderLog) {
  const items = alertsData
    .map((alert) => {
      if (alert.type === "overdue") {
        const href = whatsappLink(alert.parentPhone, reminderText(alert));
        return `<li>${escapeHtml(alert.personName)} | owed ${formatRupees(alert.amountOwed)} | ${alert.daysLate} days late <a class="button" target="_blank" rel="noopener" href="${escapeHtml(href)}" data-action="log-reminder" data-invoice-id="${escapeHtml(alert.invoiceId)}">Send reminder</a></li>`;
      }
      if (alert.type === "cash") {
        return `<li>${escapeHtml(alert.name)} | below zero on ${escapeHtml(alert.date)} | lowest ${formatRupees(alert.lowest.balance)} <a class="button" href="#forecast">View forecast</a></li>`;
      }
      return `<li>${escapeHtml(alert.name)} | due ${escapeHtml(alert.dueDate)} | ${formatRupees(alert.amount)} <a class="button" href="#bills">View bills</a></li>`;
    })
    .join("");
  const logRows = reminderLog
    .map(
      (r) =>
        `<li>${escapeHtml(r.date)} | ${escapeHtml(r.parentName)} | ${formatRupees(r.amount)} | ${escapeHtml(r.tone)}</li>`
    )
    .join("");
  return `<section>
<h1>Alerts</h1>
${items ? `<ul>${items}</ul>` : emptyState("No alerts right now. Everything is on track.")}
<h2>Reminders sent</h2>
${logRows ? `<ul>${logRows}</ul>` : emptyState("No reminders sent yet. Send one from an overdue alert.")}
</section>`;
}
