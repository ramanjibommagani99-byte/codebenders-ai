import { students } from "./students.js";

export default { title: "Invoices" };

const months = [10, 11];
const pad = (n) => String(n).padStart(2, "0");

// Status plan by student index, same for each month:
// 5 paid on time, 2 paid late, 2 part paid, 3 unpaid (overdue as of 2026-11-22).
function statusFor(i) {
  if (i < 5) return "paid";
  if (i < 7) return "paid_late";
  if (i < 9) return "part_paid";
  return "unpaid";
}

// Sample data only.
export const invoices = [];
for (const month of months) {
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const status = statusFor(i);
    const dueDate = `2026-${pad(month)}-${pad(s.dueDay)}`;
    const invoice = {
      id: `INV-2026-${pad(month)}-${s.id}`,
      studentId: s.id,
      month: `2026-${pad(month)}`,
      amount: s.monthlyFee,
      paidAmount: 0,
      dueDate,
      status,
    };
    if (status === "paid") {
      invoice.paidAmount = s.monthlyFee;
      invoice.paidDate = dueDate;
    } else if (status === "paid_late") {
      invoice.paidAmount = s.monthlyFee;
      invoice.paidDate = `2026-${pad(month)}-${pad(s.dueDay + 5)}`;
    } else if (status === "part_paid") {
      invoice.paidAmount = Math.round(s.monthlyFee / 2);
      invoice.paidDate = dueDate;
    }
    invoices.push(invoice);
  }
}
