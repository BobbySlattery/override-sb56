import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface EmailPayload {
  senderName: string;
  senderEmail: string;
  senderAddress: string;
  senderZip: string;
  recipients: {
    name: string;
    email: string;
    title?: string;
  }[];
  houseDistrict: number | null;
  senateDistrict: number | null;
}

function buildEmailBody(
  senderName: string,
  senderAddress: string,
  senderZip: string,
  recipientName: string,
  recipientTitle: string | undefined,
  houseDistrict: number | null,
  senateDistrict: number | null
): string {
  const districtInfo =
    houseDistrict && senateDistrict
      ? `As a resident of Ohio House District ${houseDistrict} and Senate District ${senateDistrict}`
      : houseDistrict
      ? `As a resident of Ohio House District ${houseDistrict}`
      : senateDistrict
      ? `As a resident of Ohio Senate District ${senateDistrict}`
      : "As an Ohio resident";

  return `Dear ${recipientTitle ? recipientTitle + " " : ""}${recipientName},

${districtInfo} at ${senderAddress}, ${senderZip}, I am writing to urge you to bring Governor DeWine's line-item veto of Senate Bill 56's THC beverage provisions to an override vote immediately.

The Ohio General Assembly passed SB 56 with strong bipartisan support, including carefully crafted provisions that would have allowed the regulated sale of low-dose (5mg) THC-infused beverages through December 31, 2026. Governor DeWine's line-item veto stripped 15 pages and 17 sections from the bill — fundamentally changing what the legislature voted on. This was not a surgical line-item veto of an appropriation; it was a wholesale rewrite of policy that the legislature had deliberated and approved.

This matters because:

- Ohio's craft breweries, small businesses, and hemp beverage manufacturers invested in good faith based on the regulatory framework the legislature created. The veto has put hundreds of jobs and millions in investment at risk overnight.

- The legislature — not the Governor — sets policy in Ohio. Allowing this overreach to stand sets a dangerous precedent for executive power over the legislative process.

- The votes to override exist in both chambers. The only thing standing in the way is leadership's refusal to bring it to the floor.

I respectfully ask that you publicly call for and support bringing the override vote to the floor of both the House and Senate. Ohio's small businesses, workers, and the integrity of the legislative process depend on it.

Thank you for your service to our state. I look forward to your response.

Sincerely,
${senderName}
${senderAddress}
${senderZip}, Ohio`;
}

export async function POST(request: NextRequest) {
  try {
    const payload: EmailPayload = await request.json();
    const { senderName, senderEmail, senderAddress, senderZip, recipients, houseDistrict, senateDistrict } =
      payload;

    if (!senderName || !senderEmail || !recipients?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Configure nodemailer transporter
    // Supports SMTP (Gmail, SendGrid, etc.) via environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.FROM_EMAIL || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: "Email service not configured. Please set SMTP environment variables." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const results = [];

    for (const recipient of recipients) {
      const body = buildEmailBody(
        senderName,
        senderAddress,
        senderZip,
        recipient.name,
        recipient.title,
        houseDistrict,
        senateDistrict
      );

      try {
        await transporter.sendMail({
          from: `"${senderName}" <${fromEmail}>`,
          to: recipient.email,
          replyTo: senderEmail,
          subject:
            "Override Governor DeWine's Line-Item Veto of SB 56 THC Beverage Provisions",
          text: body,
        });
        results.push({ email: recipient.email, status: "sent" });
      } catch (err) {
        console.error(`Failed to send to ${recipient.email}:`, err);
        results.push({ email: recipient.email, status: "failed" });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;

    return NextResponse.json({
      success: sentCount > 0,
      message: `Successfully sent ${sentCount} of ${results.length} emails`,
      results,
    });
  } catch (err) {
    console.error("Send email error:", err);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}
