import { NextRequest, NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { rateLimit } from "@/app/lib/rate-limit";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

interface BusinessSignup {
  businessName: string;
  location: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  businessType: string;
}

export async function POST(request: NextRequest) {
  // Rate limit: 3 business signups per IP per hour
  const limited = rateLimit(request, "business-signup", 3, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const payload: BusinessSignup = await request.json();
    const { businessName, location, phone, contactName, contactEmail, businessType } = payload;

    if (!businessName || !location || !phone || !contactName || !contactEmail || !businessType) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Step 1: Always save to Supabase first (this is the critical data)
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/sb56_business_signups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_name: businessName,
        location,
        phone,
        contact_name: contactName,
        contact_email: contactEmail,
        business_type: businessType,
      }),
    });

    if (!supabaseRes.ok) {
      console.error("Supabase insert failed:", await supabaseRes.text());
      // Don't fail the whole request — still try to send the email
    }

    // Step 2: Send notification email to Bobby (non-blocking — signup is already saved)
    let emailSent = false;
    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const ses = new SESv2Client({
          region: process.env.AWS_SES_REGION || "us-east-2",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        const fromEmail = process.env.FROM_EMAIL || "noreply@saveohiobevs.com";

        await ses.send(
          new SendEmailCommand({
            FromEmailAddress: `Override SB56 <${fromEmail}>`,
            Destination: {
              ToAddresses: [process.env.NOTIFICATION_EMAIL || "bobby@50westbrew.com"],
            },
            ReplyToAddresses: [contactEmail],
            Content: {
              Simple: {
                Subject: { Data: `New Business Signup: ${businessName} (${businessType})` },
                Body: {
                  Text: {
                    Data: `A new ${businessType.toLowerCase()} wants to join the Override SB 56 cause!

Business Name: ${businessName}
Business Type: ${businessType}
Location: ${location}
Phone: ${phone}
Contact Name: ${contactName}
Contact Email: ${contactEmail}

They have agreed to participate. Reach out to get their logo and fill them in on next steps.`,
                  },
                },
              },
            },
          })
        );
        emailSent = true;
      }
    } catch (emailErr) {
      console.error("Email notification failed (signup still saved):", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Signup submitted successfully",
      emailSent,
    });
  } catch (err) {
    console.error("Business signup error:", err);
    return NextResponse.json(
      { error: "Failed to submit signup" },
      { status: 500 }
    );
  }
}
