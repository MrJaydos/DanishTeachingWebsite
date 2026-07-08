// Thin wrapper around nodemailer for transactional email (currently just
// password resets). Works with any SMTP provider (Gmail app password, Resend,
// Brevo, etc) via the SMTP_* env vars. If SMTP isn't configured (e.g. local
// dev before you've set credentials), emails are logged to the console
// instead of sent, so the flow still works end-to-end without real SMTP.

import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter;

function isConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(email, resetUrl) {
  if (!isConfigured()) {
    console.log(
      `[mailer] SMTP not configured — password reset link for ${email}:\n  ${resetUrl}`
    );
    return;
  }

  await getTransporter().sendMail({
    from: config.smtp.from,
    to: email,
    subject: "Reset your Dansk password",
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `<p>Someone requested a password reset for your Dansk account.</p>
<p><a href="${resetUrl}">Click here to reset your password</a> (expires in 1 hour).</p>
<p>If you didn't request this, you can ignore this email.</p>`,
  });
}
