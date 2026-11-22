import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickEntry } from "../lib/quickentry.js";

// Inline test data only; the app's sample data is not imported.
const students = [
  { id: "S1", name: "Aarav Sharma" },
  { id: "S2", name: "Priya Rao" },
];
const invoices = [
  { id: "A-SEP", studentId: "S1", amount: 1500, dueDate: "2026-09-05" },
  { id: "A-OCT", studentId: "S1", amount: 1500, dueDate: "2026-10-05" },
  { id: "A-NOV", studentId: "S1", amount: 1500, dueDate: "2026-11-05" },
  { id: "P-NOV", studentId: "S2", amount: 1500, dueDate: "2026-11-03" },
];
const payments = [{ id: "x", invoiceId: "A-SEP", amount: 1500, date: "2026-09-05" }];
const today = "2026-11-22";

test("Aarav paid 1000 UPI yesterday", () => {
  const r = parseQuickEntry("Aarav paid 1000 UPI yesterday", students, invoices, payments, today);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 1000);
  assert.equal(r.method, "UPI");
  assert.equal(r.date, "2026-11-21");
  assert.equal(r.studentName, "Aarav Sharma");
  assert.equal(r.invoiceId, "A-OCT");
});

test("Priya paid 1500 cash today", () => {
  const r = parseQuickEntry("Priya paid 1500 cash today", students, invoices, payments, today);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 1500);
  assert.equal(r.method, "cash");
  assert.equal(r.date, today);
  assert.equal(r.invoiceId, "P-NOV");
});

test("written date 21 Nov is read as 2026-11-21 and not as the amount", () => {
  const r = parseQuickEntry("Aarav paid 1000 UPI on 21 Nov", students, invoices, payments, today);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 1000);
  assert.equal(r.date, "2026-11-21");
});

test("unknown name yields notFound", () => {
  const r = parseQuickEntry("Rahul paid 1000 cash", students, invoices, payments, today);
  assert.deepEqual(r, { error: "notFound" });
});

test("two students sharing a first name yield ambiguous with both options", () => {
  const twins = [
    { id: "S1", name: "Aarav Sharma" },
    { id: "S3", name: "Aarav Patel" },
  ];
  const r = parseQuickEntry("Aarav paid 1000 UPI yesterday", twins, invoices, payments, today);
  assert.equal(r.error, "ambiguous");
  assert.deepEqual(r.options, ["Aarav Sharma", "Aarav Patel"]);
});

test("a full name picks one of the ambiguous students", () => {
  const twins = [
    { id: "S1", name: "Aarav Sharma" },
    { id: "S3", name: "Aarav Patel" },
  ];
  const r = parseQuickEntry("Aarav Patel paid 1000 UPI", twins, [], [], today);
  assert.equal(r.error, "noInvoice");
  const r2 = parseQuickEntry("Aarav Sharma paid 1000 UPI", twins, invoices, payments, today);
  assert.equal(r2.ok, true);
  assert.equal(r2.studentName, "Aarav Sharma");
});

test("missing amount and missing method are reported", () => {
  assert.equal(parseQuickEntry("Aarav paid UPI", students, invoices, payments, today).error, "noAmount");
  assert.equal(parseQuickEntry("Aarav paid 1000", students, invoices, payments, today).error, "noMethod");
});
