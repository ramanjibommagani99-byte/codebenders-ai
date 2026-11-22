import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderText, whatsappLink, billAlerts } from "../lib/alerts.js";

const alertFor = (daysLate) => ({ personName: "Sunil Sharma", amountOwed: 2300, daysLate });

test("reminderText opening phrase follows days late", () => {
  assert.ok(reminderText(alertFor(5)).startsWith("Hi Sunil Sharma,"));
  assert.ok(reminderText(alertFor(5)).includes("friendly"));
  assert.ok(reminderText(alertFor(10)).includes("follow-up"));
  assert.ok(reminderText(alertFor(20)).includes("final"));
});

test("whatsappLink builds a wa.me link with the country code and digits only", () => {
  assert.ok(whatsappLink("9876543210", "Hello").startsWith("https://wa.me/919876543210?text="));
  assert.equal(whatsappLink("98765-43210", "Hi there"), "https://wa.me/919876543210?text=Hi%20there");
});

test("billAlerts includes a bill due in 3 days and excludes one due later", () => {
  const bills = [
    { id: "a", name: "Internet", amount: 700, dueDate: "2026-11-24" },
    { id: "b", name: "Materials", amount: 1500, dueDate: "2026-12-10" },
  ];
  const alerts = billAlerts(bills, "2026-11-22");
  const names = alerts.map((a) => a.name);
  assert.ok(names.includes("Internet"));
  assert.ok(!names.includes("Materials"));
});
