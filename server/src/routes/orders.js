const express = require("express");
const prisma = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// All Orders endpoints require admin authentication.
router.use(requireAdmin);

// Get all confirmed orders with customer, payment and invoice details.
router.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        lead: {
          select: {
            id: true,
            customerName: true,
            email: true,
            mobile: true,
            service: true
          }
        },
        payment: {
          select: {
            id: true,
            cashfreeOrderId: true,
            cashfreePaymentId: true,
            amount: true,
            currency: true,
            status: true,
            paymentDate: true
          }
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            emailStatus: true,
            emailSentAt: true,
            emailError: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      total: orders.length,
      orders
    });

  } catch (error) {
    next(error);
  }
});

// Get one order by its database ID.
router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        lead: true,
        payment: true,
        invoice: true
      }
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    res.json({ order });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
