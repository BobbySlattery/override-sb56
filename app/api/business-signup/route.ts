import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface BusinessSignup {
  businessName: string;
  location: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  businessType: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: BusinessSignup = await request.json();
    const { businessName, location, phone, contactName, contactEmail, businessType } = payload;

    if (!businessName || !location || !phone || !contactName || !contactEmail || !businessType) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.FROM_EMAIL || "noreply@overridetheveto.com";

    await resend.emails.send({
      from: `Override SB56 <${fromEmail}>`,
      to: ["bobby@50westbrew.com"],
      replyTo: contactEmail,
      subject: `New Business Signup: ${businessName} (${businessType})`,
      text: `A new ${businessType.toLowerCase()} wants to join the Override SB 56 cause!

Business Name: ${businessName}
Business Type: ${businessType}
Location: ${location}
Phone: ${phone}
Contact Name: ${contactName}
Contact Email: ${contactEmail}

They have agreed to participate. Reach out to get their logo and fill them in on next steps.`,
    });

    return NextResponse.json({
      success: true,
      message: "Signup submitted successfully",
    });
  } catch (err) {
    console.error("Business signup error:", err);
    return NextResponse.json(
      { error: "Failed to submit signup" },
      { status: 500 }
    );
  }
}
