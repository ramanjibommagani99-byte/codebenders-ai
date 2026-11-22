import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureNextInvoices, presetWhatIf } from "../lib/forecast.js";

// Inline test data only; the app's sample data is not imported.
const students = [
  { id: "S1", name: "Aarav Sharma", monthlyFee: 1500, dueDay: 5 },
  { id: "S2", name: "Priya Rao", monthlyFee: 2000, dueDay: 10 },
];
const today = "2026-11-22";
const payments = [];

test("ensureNextInvoices adds Dec 2026 and Jan 2027 per student on dueDay, without duplicates", () => {
  const invoices = [{ id: "INV-2026-11-S1", studentId: "S1", month: "2026-11", amount: 1500, dueDate: "2026-11-05" }];
  const once = ensureNextInvoices(invoices, students, today, 2);
  const added = once.slice(invoices.length);
  assert.equal(added.length, 4);
  const s1Dec = once.find((inv) => inv.studentId === "S1" && inv.month === "2026-12");
  assert.equal(s1Dec.dueDate, "2026-12-05");
  assert.equal(s1Dec.amount, 1500);
  const s2Jan = once.find((inv) => inv.studentId === "S2" && inv.month === "2027-01");
  assert.equal(s2Jan.dueDate, "2027-01-10");
  assert.equal(s2Jan.amount, 2000);
  assert.equal(s2Jan.status, "Sent");
  assert.equal(s2Jan.paidDate, null);
  // Running it again adds nothing.
  const twice = ensureNextInvoices(once, students, today, 2);
  assert.equal(twice.length, once.length);
  // The input array is not mutated.
  assert.equal(invoices.length, 1);
});

test("hike200 adds exactly 200 to next-month amounts and leaves current-month amounts unchanged", () => {
  const invoices = [
    { id: "A", studentId: "S1", month: "2026-11", amount: 1500, dueDate: "2026-11-05" },
    { id: "B", studentId: "S1", month: "2026-12", amount: 1500, dueDate: "2026-12-05" },
    { id: "C", studentId: "S2", month: "2027-01", amount: 2000, dueDate: "2027-01-10" },
  ];
  const out = presetWhatIf("hike200", invoices, students, today, payments, {}).invoices;
  assert.equal(out.find((i) => i.id === "A").amount, 1500);
  assert.equal(out.find((i) => i.id === "B").amount, 1700);
  assert.equal(out.find((i) => i.id === "C").amount, 2200);
  // Input is not mutated.
  assert.equal(invoices[1].amount, 1500);
});

test("leave3 removes exactly 3 students' next-month invoices", () => {
  const four = [
    { id: "S1", monthlyFee: 1000, dueDay: 5 },
    { id: "S2", monthlyFee: 1000, dueDay: 5 },
    { id: "S3", monthlyFee: 1000, dueDay: 5 },
    { id: "S4", monthlyFee: 1000, dueDay: 5 },
  ];
  const invoices = [
    { id: "N1", studentId: "S1", month: "2026-11", amount: 1000, dueDate: "2026-11-05" },
    ...four.map((s) => ({ id: `D-${s.id}`, studentId: s.id, month: "2026-12", amount: 1000, dueDate: `2026-12-05` })),
  ];
  const out = presetWhatIf("leave3", invoices, four, today, payments, {}).invoices;
  // Current-month invoice is kept even for a leaving student.
  assert.ok(out.some((i) => i.id === "N1"));
  const decLeft = out.filter((i) => i.month === "2026-12").map((i) => i.studentId);
  assert.deepEqual(decLeft, ["S4"]);
});
