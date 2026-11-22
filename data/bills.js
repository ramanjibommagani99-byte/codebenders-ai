export default { title: "Bills" };

// Sample data only: monthly bills.
const monthlyBills = [
  { name: "Rent", amount: 8000 },
  { name: "Internet", amount: 700 },
  { name: "Materials", amount: 1500 },
];

export const bills = [];
for (const b of monthlyBills) {
  bills.push({
    id: b.name.toLowerCase(),
    name: b.name,
    amount: b.amount,
    frequency: "monthly",
  });
}

// Bills screen list. dueDate is "YYYY-MM-DD"; frequency is "monthly" or "oneoff".
export const billList = [
  { id: "rent", name: "Rent", amount: 8000, dueDate: "2026-12-01", frequency: "monthly" },
  { id: "internet", name: "Internet", amount: 700, dueDate: "2026-12-03", frequency: "monthly" },
  { id: "materials", name: "Materials", amount: 1500, dueDate: "2026-12-10", frequency: "oneoff" },
];
