
const express = require("express");
const prisma = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { generateInvoicePdf } = require("../services/invoicePdf");

const router = express.Router();

// All invoice routes require admin authentication.
router.use(requireAdmin);

// Download an invoice as PDF.
router.get("/:id/pdf", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found."
      });
    }

    const pdfBuffer = await generateInvoicePdf(invoice);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

