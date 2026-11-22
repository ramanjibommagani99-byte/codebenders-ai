// Invoice status and amount owed. Computed from the invoice and payments, never stored.
// Dates are ISO "YYYY-MM-DD" strings, so plain string comparison orders them correctly.

function amountPaid(invoice, payments) {
  return payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

export function amountOwed(invoice, payments) {
  return Math.max(0, invoice.amount - amountPaid(invoice, payments));
}

export function invoiceStatus(invoice, payments, today) {
  const owed = amountOwed(invoice, payments);
  if (owed === 0) return "Paid";
  if (amountPaid(invoice, payments) > 0) return "Partly paid";
  if (invoice.dueDate < today) return "Overdue";
  return "Sent";
}
