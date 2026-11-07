
const express = require("express");
const prisma = require("../db");
const cashfree = require("../config/cashfree");
const { generateInvoicePdf } = require("../services/invoicePdf");
const { sendInvoiceEmail } = require("../services/emailService");

const router = express.Router();

router.get("/verify/:orderId", async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { cashfreeOrderId: orderId },
      include: { lead: true }
    });

    if (!payment) {
      return res.status(404).json({
        error: "Payment order not found."
      });
    }

    // Fetch order from Cashfree.
    const orderResponse = await cashfree.PGFetchOrder(orderId);
    const cashfreeOrder = orderResponse.data;

    if (
      Number(cashfreeOrder.order_amount) !== Number(payment.amount) ||
      cashfreeOrder.order_currency !== payment.currency
    ) {
      return res.status(400).json({
        error: "Payment order details do not match."
      });
    }

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

        // Send invoice email after successful payment.
    let emailStatus = result.invoice?.emailStatus || "Pending";

    if (
      result.invoice &&
      emailStatus !== "Sent"
    ) {
      try {
        const pdfBuffer = await generateInvoicePdf(result.invoice);

        await sendInvoiceEmail(result.invoice, pdfBuffer);

        await prisma.invoice.update({
          where: { id: result.invoice.id },
          data: {
            emailStatus: "Sent",
            emailSentAt: new Date(),
            emailError: null
          }
        });

        emailStatus = "Sent";

        console.log(
          `Invoice ${result.invoice.invoiceNumber} emailed successfully.`
        );
      } catch (emailError) {
        console.error("Invoice email failed:", emailError.message);

        await prisma.invoice.update({
          where: { id: result.invoice.id },
          data: {
            emailStatus: "Failed",
            emailError: emailError.message
          }
        });

        emailStatus = "Failed";
      }
    }

    return res.json({
      message: result.alreadyProcessed
        ? "Payment was already processed."
        : "Payment verified and order created successfully.",
      paymentStatus: "Successful",
      emailStatus,
      orderId,
      leadId: payment.leadId,
      databaseOrderId: result.order?.id,
      invoiceId: result.order?.invoice?.id || result.invoice?.id
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
