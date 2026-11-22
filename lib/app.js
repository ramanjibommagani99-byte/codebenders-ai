import { currentRoute, onRouteChange } from "./router.js";
import { renderScreen, renderStudents, renderInvoices, renderDashboard, renderBills, renderForecast, renderAlerts, formatLongDate } from "./render.js";
import { amountOwed } from "./status.js";
import { parseQuickEntry } from "./quickentry.js";
import {
  forecast as runForecast,
  averageDaysLateByStudent,
  delayParent,
  removeStudents,
  ensureNextInvoices,
  presetWhatIf,
} from "./forecast.js";
import { overdueAlerts, cashAlerts, billAlerts, toneFor } from "./alerts.js";
import dashboard from "../data/dashboard.js";
import students, { students as sampleStudents } from "../data/students.js";
import invoices, { invoices as invoiceList } from "../data/invoices.js";
import { payments } from "../data/payments.js";
import { settings } from "../data/settings.js";
import bills, { billList } from "../data/bills.js";
import forecast from "../data/forecast.js";
import alerts from "../data/alerts.js";

const pages = { dashboard, students, invoices, bills, forecast, alerts };
const app = document.getElementById("app");
const navLinks = document.querySelectorAll(".bottom-nav a");

// Forecast screen state. horizonDays is 30, 60 or 90. whatIf holds the what-if form settings.
let horizonDays = 30;
let whatIf = { mode: "late", studentId: sampleStudents[0].id, days: 7, count: 1 };
// Name of the one-tap preset in use (key15, leave3, summer, hike200), or null for the custom what-if form.
let activePreset = null;

// Reminders sent from the Alerts or Dashboard screens: { date, invoiceId, parentName, amount, tone }.
const reminderLog = [];

// Quick entry box on the Dashboard: { text, pending, error, options }.
// pending holds a parsed entry waiting for Confirm; error is a code from lib/render.js; options feeds the ambiguous picks.
function emptyQuick() {
  return { text: "", pending: null, error: null, options: [] };
}
let quickEntry = emptyQuick();

// Header date, e.g. "Sun, 22 Nov 2026", from the demo "today" in data/settings.js.
document.getElementById("app-date").textContent = formatLongDate(settings.today);

// Pristine copies of the sample data, taken before any edit, so Reset demo can restore them.
const pristine = {
  students: structuredClone(sampleStudents),
  invoices: structuredClone(invoiceList),
  payments: structuredClone(payments),
  bills: structuredClone(billList),
};

// Empty an imported array in place, then refill it from a fresh copy of the pristine data.
function replaceContents(target, source) {
  target.length = 0;
  target.push(...structuredClone(source));
}

// Restore every sample list, the reminder log and the forecast controls to their starting values.
function resetDemo() {
  replaceContents(sampleStudents, pristine.students);
  replaceContents(invoiceList, pristine.invoices);
  replaceContents(payments, pristine.payments);
  replaceContents(billList, pristine.bills);
  reminderLog.length = 0;
  quickEntry = emptyQuick();
  horizonDays = 30;
  whatIf = { mode: "late", studentId: sampleStudents[0].id, days: 7, count: 1 };
  activePreset = null;
}

// Alerts screen: overdue invoices, cash going below zero within 30 days, bills due in 3 days.
function alertsView() {
  const avgLate = averageDaysLateByStudent(invoiceList, payments);
  const fc = runForecast({
    openingBalance: settings.openingBalance,
    today: settings.today,
    payments,
    bills: billList,
    invoices: invoiceList,
    horizonDays: 90,
    parentAvgDaysLate: avgLate,
  });
  return [
    ...overdueAlerts(invoiceList, payments, sampleStudents, settings.today),
    ...cashAlerts(fc, settings.today, 30),
    ...billAlerts(billList, settings.today),
  ];
}

// Lowest forecast balance within the next 30 days of settings.today, for the Dashboard summary strip.
function lowestCashNext30() {
  const fc = runForecast({
    openingBalance: settings.openingBalance,
    today: settings.today,
    payments,
    bills: billList,
    invoices: invoiceList,
    horizonDays: 30,
    parentAvgDaysLate: averageDaysLateByStudent(invoiceList, payments),
  });
  return fc.lowest;
}

// Normal forecast and what-if forecast, computed from the same data the Dashboard uses.
function forecastView() {
  // Keep the next two months' invoices in the shared list, so the forecast and the Invoices screen both see them.
  replaceContents(invoiceList, ensureNextInvoices(invoiceList, sampleStudents, settings.today, 2));
  const base = {
    openingBalance: settings.openingBalance,
    today: settings.today,
    payments,
    bills: billList,
    horizonDays,
  };
  const avgLate = averageDaysLateByStudent(invoiceList, payments);
  const normal = runForecast({ ...base, invoices: invoiceList, parentAvgDaysLate: avgLate });
  const scenario = activePreset
    ? presetWhatIf(activePreset, invoiceList, sampleStudents, settings.today, payments, avgLate)
    : whatIf.mode === "leave"
      ? { invoices: removeStudents(invoiceList, sampleStudents, whatIf.count, payments), parentAvgDaysLate: avgLate }
      : { invoices: invoiceList, parentAvgDaysLate: delayParent(avgLate, whatIf.studentId, whatIf.days) };
  const alt = runForecast({ ...base, ...scenario });
  return { normal, whatIf: alt, lowestChange: alt.lowest.balance - normal.lowest.balance };
}

function render() {
  const name = currentRoute();
  app.innerHTML =
    (name === "dashboard"
      ? renderDashboard(
          invoiceList,
          sampleStudents,
          payments,
          settings.today,
          quickEntry,
          reminderLog,
          averageDaysLateByStudent(invoiceList, payments),
          lowestCashNext30()
        )
      : name === "bills"
        ? renderBills(billList)
        : name === "forecast"
          ? renderForecast({ horizonDays, whatIf, activePreset, students: sampleStudents }, forecastView())
          : name === "alerts"
            ? renderAlerts(alertsView(), reminderLog)
            : renderScreen(pages[name], true)) +
    (name === "students" ? renderStudents(sampleStudents) : "") +
    (name === "invoices"
      ? renderInvoices(invoiceList, sampleStudents, payments, settings.today)
      : "");
  navLinks.forEach((link) => {
    if (link.getAttribute("href") === `#${name}`) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

// Confirm a quick entry: record it on the invoice it was matched to, then clear the box.
function confirmQuickEntry() {
  const p = quickEntry.pending;
  if (!p) return;
  const invoice = invoiceList.find((inv) => inv.id === p.invoiceId);
  if (!invoice || amountOwed(invoice, payments) < p.amount) {
    quickEntry = { ...quickEntry, pending: null, error: "overpaid", options: [] };
    return;
  }
  payments.push({
    id: `PAY-Q${payments.length + 1}`,
    invoiceId: p.invoiceId,
    amount: p.amount,
    date: p.date,
    method: p.method,
  });
  quickEntry = emptyQuick();
}

function recordPayment(form) {
  const data = new FormData(form);
  const invoice = invoiceList.find((inv) => inv.id === data.get("invoiceId"));
  if (!invoice) return "Choose an invoice.";
  const amount = Number(data.get("amount"));
  const owed = amountOwed(invoice, payments);
  if (!(amount > 0)) return "Amount must be more than 0.";
  if (amount > owed) return `Amount is more than the Rs ${owed} still owed.`;
  payments.push({
    id: `PAY-M${payments.length + 1}`,
    invoiceId: invoice.id,
    amount,
    date: data.get("date"),
    method: data.get("method"),
  });
  return null;
}

function createInvoice(form) {
  const data = new FormData(form);
  const student = sampleStudents.find((s) => s.id === data.get("studentId"));
  if (!student) return "Choose a student.";
  const month = data.get("month");
  if (invoiceList.some((inv) => inv.studentId === student.id && inv.month === month)) {
    return `${student.name} already has an invoice for that month.`;
  }
  invoiceList.push({
    id: `INV-${month}-${student.id}`,
    studentId: student.id,
    month,
    amount: student.monthlyFee,
    dueDate: `${month}-${String(student.dueDay).padStart(2, "0")}`,
  });
  return null;
}

function applyWhatIf(form) {
  const data = new FormData(form);
  const days = Number(data.get("days"));
  const count = Number(data.get("count"));
  if (!Number.isInteger(days) || days < 0 || days > 365) return "Days late must be a whole number from 0 to 365.";
  if (!Number.isInteger(count) || count < 0 || count > sampleStudents.length) {
    return `Students leaving must be a whole number from 0 to ${sampleStudents.length}.`;
  }
  const studentId = String(data.get("studentId") ?? "");
  whatIf = {
    mode: data.get("mode") === "leave" ? "leave" : "late",
    studentId: sampleStudents.some((s) => s.id === studentId) ? studentId : whatIf.studentId,
    days,
    count,
  };
  activePreset = null;
  return null;
}

function addBill(form) {
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) return "Enter a name for the bill.";
  const amount = Number(data.get("amount"));
  if (!(amount > 0)) return "Amount must be more than 0.";
  const dueDate = data.get("dueDate");
  if (!dueDate) return "Choose a due date.";
  const frequency = data.get("frequency") === "monthly" ? "monthly" : "oneoff";
  billList.push({
    id: `BILL-${billList.length + 1}`,
    name,
    amount,
    dueDate,
    frequency,
  });
  return null;
}

// Event delegation on #app so handlers survive re-rendering.
app.addEventListener("click", (event) => {
  // Quick entry preview: Confirm records it, Cancel clears the preview only.
  if (event.target.closest('[data-action="quick-confirm"]')) {
    confirmQuickEntry();
    render();
    return;
  }
  if (event.target.closest('[data-action="quick-cancel"]')) {
    quickEntry = { ...quickEntry, pending: null, error: null, options: [] };
    render();
    return;
  }
  // Ambiguous name pick: fill the input with the full name, keep the rest of the sentence, and wait for Check.
  const pick = event.target.closest('[data-action="quick-pick"]');
  if (pick) {
    const text = `${pick.dataset.name}${quickEntry.text.replace(/^\s*[A-Za-z]+/, "")}`;
    quickEntry = { text, pending: null, error: null, options: [] };
    render();
    return;
  }
  // Reset demo: confirm first, then restore the sample data and re-render.
  if (event.target.closest('[data-action="reset-demo"]')) {
    if (window.confirm("Reset the demo? This restores the sample data and clears anything you added.")) {
      resetDemo();
      render();
    }
    return;
  }
  // Reminder link: log it, but do not stop the link from opening.
  const reminder = event.target.closest('[data-action="log-reminder"]');
  if (reminder) {
    const alert = overdueAlerts(invoiceList, payments, sampleStudents, settings.today).find(
      (a) => a.invoiceId === reminder.dataset.invoiceId
    );
    if (alert) {
      reminderLog.push({
        date: settings.today,
        invoiceId: alert.invoiceId,
        parentName: alert.personName,
        amount: alert.amountOwed,
        tone: toneFor(alert.daysLate),
      });
    }
    if (currentRoute() === "alerts" || currentRoute() === "dashboard") render();
    return;
  }
  // Forecast preset: draws its what-if line next to the normal line.
  const presetButton = event.target.closest('[data-action="preset"]');
  if (presetButton) {
    activePreset = presetButton.dataset.preset;
    render();
    return;
  }
  const horizonButton = event.target.closest("[data-horizon]");
  if (horizonButton) {
    horizonDays = Number(horizonButton.dataset.horizon);
    render();
    return;
  }
  const toggle = event.target.closest("[data-toggle]");
  if (!toggle) return;
  const form = document.getElementById(toggle.dataset.toggle);
  form.hidden = !form.hidden;
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "quick-entry-form") {
    const text = String(new FormData(form).get("text") ?? "");
    const result = parseQuickEntry(text, sampleStudents, invoiceList, payments, settings.today);
    quickEntry = result.ok
      ? { text, pending: result, error: null, options: [] }
      : { text, pending: null, error: result.error, options: result.options ?? [] };
    render();
    return;
  }
  let error = null;
  if (form.id === "payment-form") error = recordPayment(form);
  else if (form.id === "invoice-form") error = createInvoice(form);
  else if (form.id === "bill-form") error = addBill(form);
  else if (form.id === "whatif-form") error = applyWhatIf(form);
  else return;
  if (error) {
    alert(error);
    return;
  }
  render();
});

onRouteChange(render);
render();
