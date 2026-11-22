// Cash forecast. Pure functions, no screen code.
// Dates are ISO "YYYY-MM-DD" strings. Date arithmetic goes through Date.UTC so time zones cannot shift days.
import { amountOwed } from "./status.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  return toIso(parseIso(iso) + days * DAY_MS);
}

// Average days late per student, from fully paid invoices (paidDate minus dueDate). Students with no paid invoices are absent, so they count as 0.
export function averageDaysLateByStudent(invoiceList, paymentList) {
  const totals = {};
  for (const inv of invoiceList) {
    if (!inv.paidDate || amountOwed(inv, paymentList) > 0) continue;
    const daysLate = Math.round((parseIso(inv.paidDate) - parseIso(inv.dueDate)) / DAY_MS);
    const t = totals[inv.studentId] ?? (totals[inv.studentId] = { sum: 0, count: 0 });
    t.sum += daysLate;
    t.count += 1;
  }
  const averages = {};
  for (const id of Object.keys(totals)) {
    averages[id] = totals[id].sum / totals[id].count;
  }
  return averages;
}

// Returns { daily: [{date, balance}], lowest: {date, balance}, firstNegative: date or null }.
// Covers today through today + horizonDays inclusive. Opening balance is as of today,
// so only payments and bills dated inside that window move the balance.
// `students` is accepted for the agreed signature but is not needed: averages are keyed by studentId.
export function forecast({
  openingBalance,
  today,
  payments = [],
  bills = [],
  invoices = [],
  horizonDays,
  parentAvgDaysLate = {},
}) {
  const end = addDays(today, horizonDays);
  const inWindow = (date) => date >= today && date <= end;
  const events = []; // { date, delta }

  for (const p of payments) {
    if (inWindow(p.date)) events.push({ date: p.date, delta: Number(p.amount) });
  }

  for (const inv of invoices) {
    const owed = amountOwed(inv, payments);
    if (!(owed > 0)) continue;
    const lateBy = Math.round(parentAvgDaysLate[inv.studentId] ?? 0);
    const expected = addDays(inv.dueDate, lateBy);
    const date = expected > today ? expected : today;
    if (inWindow(date)) events.push({ date, delta: owed });
  }

  const endIndex = Number(end.slice(0, 4)) * 12 + (Number(end.slice(5, 7)) - 1);
  for (const b of bills) {
    const amount = Number(b.amount);
    const monthly = b.frequency === "monthly" || b.monthly === true;
    if (!monthly) {
      if (inWindow(b.dueDate)) events.push({ date: b.dueDate, delta: -amount });
      continue;
    }
    // Monthly: same day-of-month from the bill's first due month, clamped to month end (e.g. 31 -> 30 Nov).
    const dayOfMonth = Number(b.dueDate.slice(8, 10));
    const startIndex = Number(b.dueDate.slice(0, 4)) * 12 + (Number(b.dueDate.slice(5, 7)) - 1);
    for (let idx = startIndex; idx <= endIndex; idx++) {
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1; // 1-based month
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const date = toIso(Date.UTC(y, m - 1, Math.min(dayOfMonth, lastDay)));
      if (date >= b.dueDate && inWindow(date)) events.push({ date, delta: -amount });
    }
  }

  const daily = [];
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    let balance = openingBalance;
    for (const e of events) {
      if (e.date <= date) balance += e.delta;
    }
    daily.push({ date, balance });
  }

  let lowest = null;
  let firstNegative = null;
  for (const day of daily) {
    // Strict "<" keeps the earliest date on ties.
    if (lowest === null || day.balance < lowest.balance) lowest = { date: day.date, balance: day.balance };
    if (firstNegative === null && day.balance < 0) firstNegative = day.date;
  }

  return { daily, lowest, firstNegative };
}

// What-if helpers. Pure: neither function mutates its inputs.

// Returns a new average-days-late map with one student's average increased by extraDays.
// Keys are studentIds, the same keys averageDaysLateByStudent returns. A student with no paid history starts from 0.
export function delayParent(parentAvgDaysLate, studentId, extraDays) {
  const next = { ...parentAvgDaysLate };
  next[studentId] = (next[studentId] ?? 0) + Number(extraDays);
  return next;
}

// Returns a new invoices array without the unpaid invoices of the first `count` students (sorted by id).
// Paid invoices are kept. "Unpaid" means amountOwed(invoice, payments) > 0.
// Leave mode reduces expected payments only: bills in this app are not per-student, so bills are not changed here.
export function removeStudents(invoices, students, count, payments = []) {
  const leaving = new Set(
    [...students]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, Math.max(0, Math.floor(Number(count) || 0)))
      .map((s) => s.id)
  );
  return invoices.filter((inv) => !(leaving.has(inv.studentId) && amountOwed(inv, payments) > 0));
}

// Month helpers for "YYYY-MM" strings.
function monthIndex(ym) {
  return Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);
}

function monthFromIndex(idx) {
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function invoiceMonth(inv) {
  return inv.month ?? inv.dueDate.slice(0, 7);
}

// Adds one invoice per student for each of the monthsAhead months after today's month, due on the student's dueDay.
// A student's month is skipped if they already have an invoice for it. Pure: returns a new array, inputs are not mutated.
export function ensureNextInvoices(invoiceList, studentList, today, monthsAhead = 2) {
  const result = [...invoiceList];
  const base = monthIndex(today);
  for (const s of studentList) {
    for (let k = 1; k <= monthsAhead; k++) {
      const month = monthFromIndex(base + k);
      if (result.some((inv) => inv.studentId === s.id && invoiceMonth(inv) === month)) continue;
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const day = Math.min(Number(s.dueDay), lastDay); // clamp e.g. due day 31 in a 30-day month
      result.push({
        id: `INV-${month}-${s.id}`,
        studentId: s.id,
        month,
        amount: Number(s.monthlyFee),
        dueDate: `${month}-${String(day).padStart(2, "0")}`,
        paidAmount: 0,
        status: "Sent",
        paidDate: null,
      });
    }
  }
  return result;
}

// One-tap Forecast presets. Each returns the what-if scenario { invoices, parentAvgDaysLate } to run next to the normal forecast.
// Pure: inputs are not mutated. An unknown name returns the normal scenario unchanged.
//   key15:   the student with the largest monthlyFee has a parent 15 days later than usual.
//   leave3:  3 students leave from next month (their unpaid invoices dated after today's month are removed).
//   summer:  no new invoices for the next 2 months (unpaid invoices in that window are removed).
//   hike200: Rs 200 added to each unpaid invoice dated after today's month.
export function presetWhatIf(name, invoiceList, studentList, today, payments, baseAvgLate) {
  const cur = today.slice(0, 7);
  if (name === "key15") {
    if (studentList.length === 0) return { invoices: invoiceList, parentAvgDaysLate: baseAvgLate };
    const biggest = studentList.reduce((best, s) => (Number(s.monthlyFee) > Number(best.monthlyFee) ? s : best));
    return { invoices: invoiceList, parentAvgDaysLate: delayParent(baseAvgLate, biggest.id, 15) };
  }
  if (name === "leave3") {
    const earlier = invoiceList.filter((inv) => invoiceMonth(inv) <= cur);
    const later = invoiceList.filter((inv) => invoiceMonth(inv) > cur);
    return {
      invoices: [...earlier, ...removeStudents(later, studentList, 3, payments)],
      parentAvgDaysLate: baseAvgLate,
    };
  }
  if (name === "summer") {
    const endMonth = monthFromIndex(monthIndex(cur) + 2);
    const inSummer = (inv) => invoiceMonth(inv) > cur && invoiceMonth(inv) <= endMonth;
    return {
      invoices: invoiceList.filter((inv) => !(inSummer(inv) && amountOwed(inv, payments) > 0)),
      parentAvgDaysLate: baseAvgLate,
    };
  }
  if (name === "hike200") {
    // Only unpaid invoices take the hike: a fully paid invoice would otherwise show Rs 200 owed.
    return {
      invoices: invoiceList.map((inv) =>
        invoiceMonth(inv) > cur && amountOwed(inv, payments) > 0 ? { ...inv, amount: Number(inv.amount) + 200 } : inv
      ),
      parentAvgDaysLate: baseAvgLate,
    };
  }
  return { invoices: invoiceList, parentAvgDaysLate: baseAvgLate };
}


