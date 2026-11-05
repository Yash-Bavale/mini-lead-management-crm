const test = require("node:test");
const assert = require("node:assert/strict");
const { createLeadSchema, updateLeadSchema } = require("../src/validation");

test("accepts a valid lead", () => {
  const result = createLeadSchema.safeParse({
    customerName: "Aarav Patil",
    mobile: "9876543210",
    email: "aarav@example.com",
    service: "Product A",
    message: ""
  });
  assert.equal(result.success, true);
});

test("rejects invalid email and unsupported service", () => {
  const result = createLeadSchema.safeParse({
    customerName: "Aarav Patil",
    mobile: "9876543210",
    email: "not-an-email",
    service: "Product Z"
  });
  assert.equal(result.success, false);
});

test("rejects empty admin update", () => {
  assert.equal(updateLeadSchema.safeParse({}).success, false);
});
