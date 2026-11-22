// Alerts. Pure functions, no DOM.
// Dates are ISO "YYYY-MM-DD" strings. Day counts go through Date.UTC so time zones cannot shift them.
import { amountOwed, invoiceStatus } from "./status.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days from one ISO date to another (to minus from).
function daysBetween(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

function formatRupees(amount) {
  return `Rs ${Number(amount).toLocaleString("en-IN")}`;
}

// Tone of a reminder by days late: 1 to 7 friendly, 8 to 15 firm, 16 or more final.
export function toneFor(daysLate) {
  if (daysLate >= 16) return "final";
  if (daysLate >= 8) return "firm";
  return "friendly";
}

export function overdueAlerts(invoices, payments, students, today) {
  return invoices
    .filter((inv) => invoiceStatus(inv, payments, today) === "Overdue")
    .map((inv) => {
      const student = students.find((s) => s.id === inv.studentId);
      return {
        type: "overdue",
        invoiceId: inv.id,
        studentId: inv.studentId,
        personName: student ? student.parentName : inv.studentId,
        parentPhone: student ? student.parentPhone : "",
        amountOwed: amountOwed(inv, payments),
        daysLate: daysBetween(inv.dueDate, today),
      };
    });
}

// Top overdue invoices to chase first, ranked by amount still owed times days late (highest first).
// Each item is an overdueAlerts() entry plus studentName, score and avgDaysLate (null when the parent has no payment history).
export function chaseFirst(invoices, payments, students, today, parentAvgDaysLate = {}, limit = 3) {
  return overdueAlerts(invoices, payments, students, today)
    .map((alert) => {
      const student = students.find((s) => s.id === alert.studentId);
      const avg = parentAvgDaysLate[alert.studentId];
      return {
        ...alert,
        studentName: student ? student.name : alert.studentId,
        score: alert.amountOwed * alert.daysLate,
        avgDaysLate: Number.isFinite(avg) ? avg : null,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Payment-history note for a chaseFirst() item. "no payment history yet" appears only when the parent has no history.
export function payHistoryNote(item) {
  if (item.avgDaysLate === null) return "no payment history yet";
  const avg = Math.round(item.avgDaysLate);
  if (avg <= 0) return "usually pays on time";
  return `usually pays about ${avg} ${avg === 1 ? "day" : "days"} late`;
}

// One plain-language line for a chaseFirst() item, e.g. "Rs 3,200 owed, 14 days late, usually pays about 10 days late".
export function chaseReason(item) {
  return `${formatRupees(item.amountOwed)} owed, ${item.daysLate} days late, ${payHistoryNote(item)}`;
}


// Returns one cash alert when the first negative balance falls within horizonDays of today, otherwise [].
export function cashAlerts(forecastResult, today, horizonDays = 30) {
  const first = forecastResult.firstNegative;
  if (!first) return [];
  const days = daysBetween(today, first);
  if (days < 0 || days > horizonDays) return [];
  return [{ type: "cash", name: "Cash balance", date: first, lowest: forecastResult.lowest }];
}

// Bills due from today through today + 3 days inclusive.
export function billAlerts(billList, today) {
  return billList
    .filter((b) => {
      const days = daysBetween(today, b.dueDate);
      return days >= 0 && days <= 3;
    })
    .map((b) => ({ type: "bill", billId: b.id, name: b.name, amount: b.amount, dueDate: b.dueDate }));
}

export function reminderText(alert) {
  const parent = alert.personName;
  const amount = formatRupees(alert.amountOwed);
  const days = alert.daysLate;
  const tone = toneFor(days);
  if (tone === "final") {
    return `Hi ${parent}, this is a final reminder that ${amount} is still outstanding for tuition, ${days} days past the due date. Please pay today or contact us to settle this.`;
  }
  if (tone === "firm") {
    return `Hi ${parent}, this is a follow-up on the ${amount} still outstanding for tuition, now ${days} days past the due date. Please pay at the earliest.`;
  }
  return `Hi ${parent}, a friendly reminder that ${amount} is due for tuition, ${days} days past the due date. Please pay when you can. Thank you.`;
}

export function whatsappLink(phone, text) {
  return `https://wa.me/91${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
