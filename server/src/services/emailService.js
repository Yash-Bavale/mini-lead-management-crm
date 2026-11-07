
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.in",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD,
  },
});

async function sendInvoiceEmail(invoice, pdfBuffer) {
  const mailOptions = {
    from: `"Mini CRM" <${process.env.ZOHO_EMAIL}>`,
    to: invoice.customerEmail,
    subject: `Your Invoice ${invoice.invoiceNumber}`,
    text: `Dear ${invoice.customerName},

Thank you for your payment.

Your payment has been successfully received, and your order is confirmed.

Please find your invoice attached to this email.

Invoice Number: ${invoice.invoiceNumber}
Service: ${invoice.service}
Amount: INR ${invoice.totalAmount}

Thank you for choosing us.

Regards,
Mini CRM Team`,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail };
