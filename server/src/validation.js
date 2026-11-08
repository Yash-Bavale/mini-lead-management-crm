const { z } = require("zod");

const services = ["Product A", "Product B", "Product C", "Other"];
const statuses = ["New", "Contacted", "Interested", "Converted", "Not Interested"];

const createLeadSchema = z.object({
  customerName: z.string().trim().min(2, "Name must contain at least 2 characters.").max(100),

  mobile: z.string().trim().regex(
    /^\d{10}$/,
    "Mobile number must contain exactly 10 digits."
  ),

  email: z.string().trim().email("Enter a valid email address.").max(150),
  service: z.enum(services),
  message: z.string().trim().max(1000).optional().or(z.literal(""))
});

const updateLeadSchema = z.object({
  status: z.enum(["New", "Contacted", "Interested", "Converted"])
    .or(z.literal("Not Interested"))
    .optional(),

  internalRemarks: z.string().trim().max(2000).nullable().optional()
}).refine(
  (value) => Object.keys(value).length > 0,
  "Provide a status or internal remark to update."
);

module.exports = { createLeadSchema, updateLeadSchema, services, statuses };