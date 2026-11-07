
const express = require("express");
const prisma = require("../db");
const cashfree = require("../config/cashfree");
const { generateInvoicePdf } = require("../services/invoicePdf");
const { sendInvoiceEmail } = require("../services/emailService");

const router = express.Router();

// Prevent duplicate background email attempts in this process.
const invoicesBeingSent = new Set();

// Send invoice email without delaying payment confirmation.
async function sendInvoiceInBackground(invoice) {
  if (!invoice || invoicesBeingSent.has(invoice.id)) {
    return;
  }

  invoicesBeingSent.add(invoice.id);

  try {
    const pdfBuffer = await generateInvoicePdf(invoice);

    await sendInvoiceEmail(invoice, pdfBuffer);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        emailStatus: "Sent",
        emailSentAt: new Date(),
        emailError: null
      }
    });

    console.log(
      `Invoice ${invoice.invoiceNumber} emailed successfully.`
    );
  } catch (emailError) {
    console.error("Invoice email failed:", emailError.message);

    try {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          emailStatus: "Failed",
          emailError: emailError.message
        }
      });
    } catch (dbError) {
      console.error(
        "Could not update invoice email status:",
        dbError.message
      );
    }
  } finally {
    invoicesBeingSent.delete(invoice.id);
  }
}

router.get("/verify/:orderId", async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Find the payment and associated lead.
    const payment = await prisma.payment.findUnique({
      where: { cashfreeOrderId: orderId },
      include: { lead: true }
    });

    if (!payment) {
      return res.status(404).json({
        error: "Payment order not found."
      });
    }

    // Fetch order details from Cashfree.
    const orderResponse = await cashfree.PGFetchOrder(orderId);
    const cashfreeOrder = orderResponse.data;

    // Validate order amount and currency.
    if (
      Number(cashfreeOrder.order_amount) !== Number(payment.amount) ||
      cashfreeOrder.order_currency !== payment.currency
    ) {
      return res.status(400).json({
        error: "Payment order details do not match."
      });
    }

    // Payment must be PAID.
    if (cashfreeOrder.order_status !== "PAID") {
      return res.json({
        message: "Payment is not successful yet.",
        paymentStatus: cashfreeOrder.order_status
      });
    }

    // Fetch successful payment attempt.
    const paymentsResponse =
      await cashfree.PGOrderFetchPayments(orderId);

    const successfulPayment = paymentsResponse.data.find(
      (item) => item.payment_status === "SUCCESS"
    );

    if (!successfulPayment) {
      return res.json({
        message: "No successful payment attempt found.",
        paymentStatus: "Pending"
      });
    }

    // Validate actual paid amount.
    if (
      Number(successfulPayment.payment_amount) !==
      Number(payment.amount)
    ) {
      return res.status(400).json({
        error: "Paid amount does not match the order amount."
      });
    }

    // Update payment, create order and invoice atomically.
    const result = await prisma.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findUnique({
        where: { id: payment.id }
      });

      // Prevent duplicate order and invoice creation.
      if (existingPayment.status === "Successful") {
        const existingOrder = await tx.order.findUnique({
          where: { paymentId: payment.id },
          include: { invoice: true }
        });

        return {
          order: existingOrder,
          invoice: existingOrder?.invoice,
          alreadyProcessed: true
        };
      }

      // Mark payment successful.
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "Successful",
          cashfreePaymentId: String(
            successfulPayment.cf_payment_id
          ),
          paymentDate: successfulPayment.payment_time
            ? new Date(successfulPayment.payment_time)
            : new Date()
        }
      });

      // Create confirmed order.
      const order = await tx.order.create({
        data: {
          leadId: payment.leadId,
          paymentId: updatedPayment.id,
          service: payment.lead.service,
          amount: payment.amount,
          currency: payment.currency,
          status: "Confirmed"
        }
      });

      // Generate invoice number.
      const invoiceNumber =
        `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create invoice.
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          paymentId: updatedPayment.id,
          customerName: payment.lead.customerName,
          customerEmail: payment.lead.email,
          customerMobile: payment.lead.mobile,
          service: payment.lead.service,
          quantity: 1,
          unitPrice: payment.amount,
          totalAmount: payment.amount,
          currency: payment.currency,
          taxAmount: 0,
          emailStatus: "Pending"
        }
      });

      // Convert lead after successful payment.
      await tx.lead.update({
        where: { id: payment.leadId },
        data: { status: "Converted" }
      });

      return {
        order,
        invoice,
        alreadyProcessed: false
      };
    });

    // Return the success response without waiting for email.
    res.json({
      message: result.alreadyProcessed
        ? "Payment was already processed."
        : "Payment verified and order created successfully.",
      paymentStatus: "Successful",
      emailStatus: result.invoice?.emailStatus || "Pending",
      orderId,
      leadId: payment.leadId,
      databaseOrderId: result.order?.id,
      invoiceId: result.invoice?.id
    });

    // Start email delivery in the background.
    if (
      result.invoice &&
      result.invoice.emailStatus !== "Sent"
    ) {
      void sendInvoiceInBackground(result.invoice);
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
