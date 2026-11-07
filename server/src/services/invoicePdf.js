
const PDFDocument = require("pdfkit");

function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50
      });

      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Company heading
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("INVOICE", { align: "center" });

      doc.moveDown();

      // Invoice details
      doc.fontSize(11).font("Helvetica");

      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(
        `Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`
      );

      doc.moveDown();

      // Customer details
      doc.font("Helvetica-Bold").text("BILL TO");
      doc.font("Helvetica");

      doc.text(invoice.customerName);
      doc.text(invoice.customerEmail);
      doc.text(invoice.customerMobile);

      doc.moveDown();

      // Service details
      doc.font("Helvetica-Bold").text("SERVICE DETAILS");
      doc.moveDown(0.5);

      const tableTop = doc.y;

      doc.text("Service", 50, tableTop);
      doc.text("Qty", 300, tableTop);
      doc.text("Unit Price", 360, tableTop);
      doc.text("Total", 460, tableTop);

      doc.moveTo(50, tableTop + 20)
        .lineTo(545, tableTop + 20)
        .stroke();

      const rowTop = tableTop + 30;

      doc.font("Helvetica");
      doc.text(invoice.service, 50, rowTop);
      doc.text(String(invoice.quantity), 300, rowTop);
      doc.text(
        `INR ${Number(invoice.unitPrice).toFixed(2)}`,
        360,
        rowTop
      );
      doc.text(
        `INR ${Number(invoice.totalAmount).toFixed(2)}`,
        460,
        rowTop
      );

      doc.moveDown(4);

      // Amount summary
      doc.font("Helvetica-Bold");
      doc.text(
        `Tax: INR ${Number(invoice.taxAmount).toFixed(2)}`,
        { align: "right" }
      );

      doc.text(
        `Grand Total: INR ${Number(invoice.totalAmount).toFixed(2)}`,
        { align: "right" }
      );

      doc.moveDown(2);

      doc.font("Helvetica");
      doc.text("Payment Status: Successful");

      doc.moveDown(3);

      doc
        .fontSize(10)
        .text("Thank you for your purchase!", {
          align: "center"
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoicePdf };

