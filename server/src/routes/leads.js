
const express = require("express");
const prisma = require("../db");
const { requireAdmin } = require("../middleware/auth");
const {
  createLeadSchema,
  updateLeadSchema,
  statuses
} = require("../validation");
const cashfree = require("../config/cashfree");
const servicePrices = require("../config/pricing");

const router = express.Router();

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
      return res.status(400).json({
        error: "Invalid service selected."
      });
    }

    // Save enquiry.
    const lead = await prisma.lead.create({
      data: {
        customerName,
        mobile,
        email,
        service,
        message: message || null
      }
    });

    // Generate unique Cashfree order ID.
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
        customer_phone: mobile
      },

      order_meta: {
        return_url: `${
          process.env.CLIENT_ORIGIN || "http://localhost:5173"
        }/payment-status?order_id={order_id}`
      }
    });

    const cashfreeOrder = cashfreeResponse.data;

    // Save payment record.
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

// Helper: convert database status to frontend status.
function formatLead(lead) {
  const hasSuccessfulPayment = lead.payments.some(
    (payment) => payment.status === "Successful"
  );

  const { payments, ...leadData } = lead;

  return {
    ...leadData,
    hasSuccessfulPayment,
    status:
      lead.status === "NotInterested"
        ? "Not Interested"
        : lead.status
  };
}

// Dashboard statistics.
router.get("/stats", async (req, res, next) => {
  try {
    const grouped = await prisma.lead.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    });

    const counts = Object.fromEntries(
      grouped.map((item) => [
        item.status,
        item._count._all
      ])
    );

    const total = grouped.reduce(
      (sum, item) => sum + item._count._all,
      0
    );

    res.json({
      total,
      new: counts.New || 0,
      contacted: counts.Contacted || 0,
      converted: counts.Converted || 0
    });

  } catch (error) {
    next(error);
  }
});

// Get all leads.
router.get("/", async (req, res, next) => {
  try {
    const {
      search = "",
      service = "",
      status = ""
    } = req.query;

    if (status && !statuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status filter."
      });
    }

    // Start measuring database query time.
    const queryStartedAt = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  customerName: {
                    contains: String(search),
                    mode: "insensitive"
                  }
                },
                {
                  mobile: {
                    contains: String(search)
                  }
                }
              ]
            }
          : {}),

        ...(service ? { service: String(service) } : {}),

        ...(status
          ? {
              status:
                status === "Not Interested"
                  ? "NotInterested"
                  : status
            }
          : {})
      },

      include: {
        payments: {
          select: {
            status: true
          }
        }
      },

      orderBy: {
        createdAt: "desc"
      }
    });

    // Log database query execution time.
    console.log(
      `[PERFORMANCE] Leads database query: ${Date.now() - queryStartedAt} ms`
    );

    res.json({
      leads: leads.map(formatLead)
    });

  } catch (error) {
    next(error);
  }
});

// Get individual lead.
router.get("/:id", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: {
        id: req.params.id
      },

      include: {
        payments: {
          select: {
            status: true
          }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({
        error: "Lead not found."
      });
    }

    res.json({
      lead: formatLead(lead)
    });

  } catch (error) {
    next(error);
  }
});

// Update lead.
router.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0].message
      });
    }

    const existing = await prisma.lead.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: "Lead not found."
      });
    }

    const data = { ...parsed.data };

    // Prevent status changes after successful payment.
    if (data.status !== undefined) {
      const successfulPayment = await prisma.payment.findFirst({
        where: {
          leadId: req.params.id,
          status: "Successful"
        },
        select: {
          id: true
        }
      });

      if (successfulPayment) {
        return res.status(409).json({
          error:
            "This lead has a successful payment. Its status cannot be changed."
        });
      }
    }

    if (data.status === "Not Interested") {
      data.status = "NotInterested";
    }

    const lead = await prisma.lead.update({
      where: {
        id: req.params.id
      },
      data,

      include: {
        payments: {
          select: {
            status: true
          }
        }
      }
    });

    res.json({
      lead: formatLead(lead)
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
