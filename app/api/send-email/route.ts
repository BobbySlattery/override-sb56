import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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

// ═══════════════════════════════════════════════════════
// TESTING MODE — set to false to send to real recipients
// ═══════════════════════════════════════════════════════
const TESTING_MODE = false;
const TEST_RECIPIENTS = [
  "bobbyslattery@gmail.com",
  "bobby.slattery@fiftywestbrew.com",
];

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

I respectfully ask that you publicly call for and support bringing the override vote to the floor of both the House and Senate. Ohio's small businesses, workers, and the integrity of the legislative process depend on it.

Thank you for your service to our state. I look forward to your response.

Sincerely,
${senderName}
${senderAddress}
${senderZip}, Ohio`;
}

function buildConfirmationEmail(
  senderName: string,
  recipients: { name: string; email: string; title?: string }[],
  houseDistrict: number | null,
  senateDistrict: number | null
): string {
  const siteUrl = "https://saveohiobevs.com";
  const shareText = encodeURIComponent("Ohio's THC beverage industry needs your help. Contact your reps and demand leadership bring the override vote to the floor. It takes 2 minutes.");
  const shareUrl = encodeURIComponent(siteUrl);

  const recipientList = recipients
    .map((r) => `  - ${r.title ? r.title + " " : ""}${r.name}`)
    .join("\n");

  return `Hi ${senderName},

Thank you for making your voice heard! Your emails have been sent to the following representatives:

${recipientList}

════════════════════════════════════════
TAKE IT A STEP FURTHER — CALL THEM
════════════════════════════════════════

A phone call makes an even bigger impact. The override vote only happens if leadership brings it to the floor. Call and leave a brief message urging them to act.

Speaker of the House Matt Huffman: (614) 466-6344
Senate President Rob McColley: (614) 466-3819

Sample message: "Hi, I'm calling to urge you to bring the SB 56 override vote to the floor. Ohio's craft beverage industry and hundreds of jobs depend on it. Thank you."

════════════════════════════════════════
SPREAD THE WORD
════════════════════════════════════════

The more voices, the louder the message. Share with your friends and family:

Facebook:
https://www.facebook.com/sharer/sharer.php?u=${shareUrl}

X (Twitter):
https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}

Instagram:
Share saveohiobevs.com in your story or bio — screenshot the site and tag friends!

Email a friend:
mailto:?subject=${encodeURIComponent("Help Save Ohio's THC Beverage Industry")}&body=${encodeURIComponent(`Hey — Ohio's THC beverage industry is under threat from Governor DeWine's veto. You can contact your reps in under 2 minutes at ${siteUrl}. Please take a look!`)}

Together, we can make sure leadership hears us loud and clear.

— The SaveOhioBevs Team
saveohiobevs.com`;
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

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Email service not configured. Please set RESEND_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.FROM_EMAIL || "bobby@50westbrew.com";
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

      // In testing mode, send to test recipients instead of real ones
      const toAddresses = TESTING_MODE ? TEST_RECIPIENTS : [recipient.email];

      try {
        await resend.emails.send({
          from: `${senderName} via SaveOhioBevs <${fromEmail}>`,
          to: toAddresses,
          replyTo: senderEmail,
          subject: TESTING_MODE
            ? `[TEST - intended for ${recipient.email}] Constituent Request: Please Protect SB 56 Original Intent`
            : "Constituent Request: Please Protect SB 56 Original Intent",
          text: body,
        });
        results.push({ email: recipient.email, status: "sent" });
      } catch (err) {
        console.error(`Failed to send to ${recipient.email}:`, err);
        results.push({ email: recipient.email, status: "failed" });
      }
    }

    // Send confirmation email to the sender
    try {
      const confirmationBody = buildConfirmationEmail(
        senderName,
        recipients,
        houseDistrict,
        senateDistrict
      );

      await resend.emails.send({
        from: `SaveOhioBevs <${fromEmail}>`,
        to: TESTING_MODE ? TEST_RECIPIENTS : [senderEmail],
        subject: "You made your voice heard — here's how to do even more",
        text: confirmationBody,
      });
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
      // Don't fail the whole request if confirmation fails
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
