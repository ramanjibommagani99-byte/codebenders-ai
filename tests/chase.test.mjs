import { test } from "node:test";
import assert from "node:assert/strict";
import { chaseFirst, chaseReason } from "../lib/alerts.js";

const TODAY = "2026-11-22";
const students = [
  { id: "S1", name: "Asha Rao", parentName: "Ravi Rao", parentPhone: "9000000001" },
  { id: "S2", name: "Dev Mehta", parentName: "Hina Mehta", parentPhone: "9000000002" },
  { id: "S3", name: "Kiran Shah", parentName: "Pooja Shah", parentPhone: "9000000003" },
  { id: "S4", name: "Meera Iyer", parentName: "Suresh Iyer", parentPhone: "9000000004" },
];

// Amount-only ranking would put INV-A (5000) first; amount x days late puts INV-B (2000 x 20 = 40000) first.
const invoices = [
  { id: "INV-A", studentId: "S1", amount: 5000, dueDate: "2026-11-20" }, // 2 days late, score 10000
  { id: "INV-B", studentId: "S2", amount: 2000, dueDate: "2026-11-02" }, // 20 days late, score 40000
  { id: "INV-C", studentId: "S3", amount: 100, dueDate: "2026-11-21" }, // 1 day late, score 100
  { id: "INV-D", studentId: "S4", amount: 300, dueDate: "2026-11-10" }, // 12 days late, score 3600
  { id: "INV-E", studentId: "S1", amount: 900, dueDate: "2026-12-05" }, // not yet due, excluded
];

test("chaseFirst ranks by amount owed times days late, not amount alone", () => {
  const ranked = chaseFirst(invoices, [], students, TODAY, {});
  assert.deepEqual(
    ranked.map((r) => r.invoiceId),
    ["INV-B", "INV-A", "INV-D"]
  );
  assert.equal(ranked[0].score, 40000);
});

test("chaseFirst returns at most the limit, default 3", () => {
  assert.equal(chaseFirst(invoices, [], students, TODAY, {}).length, 3);
  assert.equal(chaseFirst(invoices, [], students, TODAY, {}, 2).length, 2);
  assert.equal(chaseFirst(invoices, [], students, TODAY, {}, 10).length, 4);
});


test("chaseReason includes amount, days late and the parent's average when history exists", () => {
  const invoice = [{ id: "INV-X", studentId: "S1", amount: 3200, dueDate: "2026-11-08" }]; // 14 days late
  const [item] = chaseFirst(invoice, [], students, TODAY, { S1: 10.2 });
  const reason = chaseReason(item);
  assert.ok(reason.includes("Rs 3,200"), reason);
  assert.ok(reason.includes("14 days late"), reason);
  assert.ok(reason.includes("about 10 days late"), reason);
  assert.equal(reason, "Rs 3,200 owed, 14 days late, usually pays about 10 days late");
});

test("chaseReason says no payment history yet when the parent has no average", () => {
  const invoice = [{ id: "INV-Y", studentId: "S2", amount: 1000, dueDate: "2026-11-12" }];
  const [item] = chaseFirst(invoice, [], students, TODAY, {});
  assert.equal(item.avgDaysLate, null);
  assert.equal(chaseReason(item), "Rs 1,000 owed, 10 days late, no payment history yet");
});

test("chaseFirst returns an empty list when nothing is overdue", () => {
  const notDue = [{ id: "INV-Z", studentId: "S1", amount: 500, dueDate: "2026-12-01" }];
  assert.deepEqual(chaseFirst(notDue, [], students, TODAY, {}), []);
});
