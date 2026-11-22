import { invoices } from "./invoices.js";

// Sample data only: one payment per paid, paid_late or part_paid invoice.
export const payments = [];
for (const inv of invoices) {
  if (inv.status === "paid" || inv.status === "paid_late" || inv.status === "part_paid") {
    payments.push({
      id: `PAY-${inv.id}`,
      invoiceId: inv.id,
      amount: inv.paidAmount,
      date: inv.paidDate,
    });
  }
}
