const express = require("express");
const prisma = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { createLeadSchema, updateLeadSchema, statuses } = require("../validation");
const cashfree = require("../config/cashfree");
const servicePrices = require("../config/pricing");

const router = express.Router();

// Public endpoint: a submitted lead is persisted in PostgreSQL.
// Public endpoint: create lead and initiate Cashfree payment.
router.post("/", async (req, res, next) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Please correct the highlighted information.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path[0],
          message: issue.message
        }))
      });
    }

    const { customerName, mobile, email, service, message } = parsed.data;

    // Get price from trusted backend configuration.
    const amount = servicePrices[service];

    if (!amount) {
      return res.status(400).json({ error: "Invalid service selected." });
    }

    // Save the enquiry.
    const lead = await prisma.lead.create({
      data: {
        customerName,
        mobile,
        email,
        service,
        message: message || null
      }
    });

    // Generate a unique Cashfree order ID.
    const cashfreeOrderId = `lead_${lead.id}_${Date.now()}`;

    // Create Cashfree payment order.
    const cashfreeResponse = await cashfree.PGCreateOrder({
      order_id: cashfreeOrderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: lead.id,
        customer_name: customerName,
        customer_email: email,
        customer_phone: mobile.replace(/\D/g, "").slice(-10)
      },
      order_meta: {
        return_url: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/payment-status?order_id={order_id}`
      }
    });

    const cashfreeOrder = cashfreeResponse.data;

    // Save payment record in PostgreSQL.
    await prisma.payment.create({
      data: {
        leadId: lead.id,
        cashfreeOrderId,
        amount,
        currency: "INR",
        status: "Pending"
      }
    });

    return res.status(201).json({
      message: "Enquiry submitted. Proceed to payment.",
      leadId: lead.id,
      orderId: cashfreeOrderId,
      amount,
      paymentSessionId: cashfreeOrder.payment_session_id
    });

  } catch (error) {
    next(error);
  }
});

// Everything below this point requires an authenticated admin.
router.use(requireAdmin);

router.get("/stats", async (req, res, next) => {
  try {
    const [total, newLeads, contacted, converted] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "New" } }),
      prisma.lead.count({ where: { status: "Contacted" } }),
      prisma.lead.count({ where: { status: "Converted" } })
    ]);
    res.json({ total, new: newLeads, contacted, converted });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const { search = "", service = "", status = "" } = req.query;
    if (status && !statuses.includes(status)) return res.status(400).json({ error: "Invalid status filter." });
    const leads = await prisma.lead.findMany({
      where: {
        ...(search ? { OR: [
          { customerName: { contains: String(search), mode: "insensitive" } },
          { mobile: { contains: String(search) } }
        ] } : {}),
        ...(service ? { service: String(service) } : {}),
        ...(status ? { status: status === "Not Interested" ? "NotInterested" : status } : {})
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ leads: leads.map((lead) => ({ ...lead, status: lead.status === "NotInterested" ? "Not Interested" : lead.status })) });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    res.json({ lead: { ...lead, status: lead.status === "NotInterested" ? "Not Interested" : lead.status } });
  } catch (error) { next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Lead not found." });

    const data = { ...parsed.data };
    if (data.status === "Not Interested") data.status = "NotInterested";
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
    res.json({ lead: { ...lead, status: lead.status === "NotInterested" ? "Not Interested" : lead.status } });
  } catch (error) { next(error); }
});

module.exports = router;
