require("dotenv").config();

const cashfree = require("../src/config/cashfree");

console.log("Cashfree SDK loaded successfully!");
console.log("Sandbox mode:", process.env.CASHFREE_ENV === "SANDBOX");

if (!cashfree) {
  throw new Error("Cashfree configuration failed");
}