import nodemailer from "nodemailer";

export type EmailResult = {
  delivered: boolean;
  stubbed: boolean;
  detail: string;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  sandbox?: boolean;
}): Promise<EmailResult> {
  if (input.sandbox) {
    console.info(`[email sandbox]\nTo: ${input.to}\nSubject: ${input.subject}\n${input.text}\n`);
    return {
      delivered: false,
      stubbed: true,
      detail: "Sample account. The email was not sent.",
    };
  }
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(
      `[email stub]\nTo: ${input.to}\nSubject: ${input.subject}\n${input.text}\n`,
    );
    return {
      delivered: false,
      stubbed: true,
      detail: "Email was written to the server log. Set SMTP_HOST to send it.",
    };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  return { delivered: true, stubbed: false, detail: "Sent" };
}
