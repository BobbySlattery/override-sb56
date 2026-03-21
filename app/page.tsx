"use client";

import { useState, useEffect, useCallback } from "react";

interface Legislator {
  district: number;
  name: string;
  party: string;
  email: string;
  chamber: string;
}

interface LookupResult {
  houseDistrict: number | null;
  senateDistrict: number | null;
  houseRep: Legislator | null;
  senator: Legislator | null;
  leadership: {
    houseSpeaker: { name: string; title: string; email: string };
    senatePresident: { name: string; title: string; email: string };
  };
}

type Step = "locate" | "review" | "send" | "done";

export default function Home() {
  const [step, setStep] = useState<Step>("locate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderZip, setSenderZip] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState(false);

  const doLookup = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_ohio") {
          setError(
            "This tool is for Ohio residents. Your location doesn't appear to be in Ohio. If you believe this is an error, please try entering your address manually."
          );
        } else {
          setError(data.error || data.message || "Failed to look up your district.");
        }
        return;
      }
      setLookupData(data);
      setStep("review");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGeolocate = useCallback(() => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doLookup(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Location access was denied. Please allow location access in your browser settings, or use the address lookup below."
          );
        } else {
          setError("Could not determine your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [doLookup]);

  // Build the list of recipients
  const getRecipients = () => {
    if (!lookupData) return [];
    const list: { name: string; email: string; title?: string; role: string; photo?: string }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rep = lookupData.houseRep as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sen = lookupData.senator as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spk = lookupData.leadership.houseSpeaker as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pres = lookupData.leadership.senatePresident as any;

    if (rep) {
      list.push({
        name: rep.name,
        email: rep.email,
        role: `Your State Representative (District ${lookupData.houseDistrict})`,
        photo: rep.photo || "",
      });
    }
    if (sen) {
      list.push({
        name: sen.name,
        email: sen.email,
        role: `Your State Senator (District ${lookupData.senateDistrict})`,
        photo: sen.photo || "",
      });
    }
    list.push({
      name: spk.name,
      email: spk.email,
      title: spk.title,
      role: "Speaker of the Ohio House",
      photo: spk.photo || "",
    });
    list.push({
      name: pres.name,
      email: pres.email,
      title: pres.title,
      role: "President of the Ohio Senate",
      photo: pres.photo || "",
    });

    return list;
  };

  const handleSendEmails = async () => {
    if (!senderName.trim() || !senderEmail.trim() || !senderAddress.trim() || !senderZip.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSending(true);
    setError(null);

    const recipients = getRecipients().map((r) => ({
      name: r.name,
      email: r.email,
      title: r.title,
    }));

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          senderAddress: senderAddress.trim(),
          senderZip: senderZip.trim(),
          recipients,
          houseDistrict: lookupData?.houseDistrict,
          senateDistrict: lookupData?.senateDistrict,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult(data.message);
        setStep("done");
      } else {
        setError(data.error || "Failed to send emails. Please try the mailto option below.");
      }
    } catch {
      setError("Network error sending emails. Please try the mailto option below.");
    } finally {
      setSending(false);
    }
  };

  // Build mailto fallback link
  const getMailtoLink = () => {
    const recipients = getRecipients();
    const toEmails = recipients.map((r) => r.email).join(",");
    const subject = encodeURIComponent(
      "Override Governor DeWine's Line-Item Veto of SB 56 THC Beverage Provisions"
    );
    const districtLine =
      lookupData?.houseDistrict && lookupData?.senateDistrict
        ? `As a resident of Ohio House District ${lookupData.houseDistrict} and Senate District ${lookupData.senateDistrict}`
        : "As an Ohio resident";

    const body = encodeURIComponent(
      `Dear Ohio Legislators,

${districtLine}${senderAddress ? ` at ${senderAddress}, ${senderZip}` : ""}, I am writing to urge you to bring Governor DeWine's line-item veto of Senate Bill 56's THC beverage provisions to an override vote immediately.

The Ohio General Assembly passed SB 56 with strong bipartisan support, including carefully crafted provisions that would have allowed the regulated sale of low-dose (5mg) THC-infused beverages through December 31, 2026. Governor DeWine's line-item veto stripped 15 pages and 17 sections from the bill — fundamentally changing what the legislature voted on.

Ohio's craft breweries, small businesses, and hemp beverage manufacturers invested in good faith based on the regulatory framework the legislature created. The veto has put hundreds of jobs and millions in investment at risk overnight.

The votes to override exist in both chambers. The only thing standing in the way is leadership's refusal to bring it to the floor.

I respectfully ask that you publicly call for and support bringing the override vote to the floor.

Sincerely,
${senderName || "[Your Name]"}
${senderAddress || "[Your Address]"}
${senderZip || "[Your Zip]"}, Ohio`
    );

    return `mailto:${toEmails}?subject=${subject}&body=${body}`;
  };

  const previewEmailBody = () => {
    const districtLine =
      lookupData?.houseDistrict && lookupData?.senateDistrict
        ? `As a resident of Ohio House District ${lookupData.houseDistrict} and Senate District ${lookupData.senateDistrict}`
        : "As an Ohio resident";

    return `Dear [Legislator Name],

${districtLine}${senderAddress ? ` at ${senderAddress}, ${senderZip}` : ""}, I am writing to urge you to bring Governor DeWine's line-item veto of Senate Bill 56's THC beverage provisions to an override vote immediately.

The Ohio General Assembly passed SB 56 with strong bipartisan support, including carefully crafted provisions that would have allowed the regulated sale of low-dose (5mg) THC-infused beverages through December 31, 2026. Governor DeWine's line-item veto stripped 15 pages and 17 sections from the bill — fundamentally changing what the legislature voted on. This was not a surgical line-item veto of an appropriation; it was a wholesale rewrite of policy that the legislature had deliberated and approved.

This matters because:

- Ohio's craft breweries, small businesses, and hemp beverage manufacturers invested in good faith based on the regulatory framework the legislature created. The veto has put hundreds of jobs and millions in investment at risk overnight.

- The legislature — not the Governor — sets policy in Ohio. Allowing this overreach to stand sets a dangerous precedent for executive power over the legislative process.

- The votes to override exist in both chambers. The only thing standing in the way is leadership's refusal to bring it to the floor.

I respectfully ask that you publicly call for and support bringing the override vote to the floor of both the House and Senate. Ohio's small businesses, workers, and the integrity of the legislative process depend on it.

Thank you for your service to our state. I look forward to your response.

Sincerely,
${senderName || "[Your Name]"}
${senderAddress || "[Your Address]"}
${senderZip || "[Your Zip]"}, Ohio`;
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="bg-red-800 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="text-sm font-semibold uppercase tracking-widest text-red-200 mb-4">
            Ohio Senate Bill 56
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Override the Veto.
            <br />
            <span className="text-amber-300">Protect Ohio's Small Businesses.</span>
          </h1>
          <p className="text-lg md:text-xl text-red-100 max-w-2xl mx-auto leading-relaxed">
            Governor DeWine line-item vetoed 15 pages of SB 56 — killing the THC
            beverage provisions the legislature passed with bipartisan support.
            <strong className="text-white">
              {" "}
              The votes to override exist. Leadership just needs to bring it to the
              floor.
            </strong>
          </p>
        </div>
      </header>

      {/* Info Bar */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-3xl mx-auto px-6 py-4 text-center text-amber-900 text-sm">
          <strong>What happened:</strong> SB 56 created a regulatory framework for
          low-dose (5mg) THC beverages. Gov. DeWine vetoed every reference to it —
          overstepping his authority and undermining the legislative process. In order
          to bring the beverages back, Speaker Huffman and Senate President McColley
          must bring the override vote to the floor.
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Step 1: Locate */}
        {step === "locate" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Contact Your Representatives
            </h2>
            <p className="text-stone-600 mb-8 max-w-xl mx-auto">
              We&apos;ll identify your Ohio State House Rep and Senator, then send them
              — along with Speaker Huffman and Senate President McColley — a message
              urging them to bring the override vote to the floor.
            </p>

            <button
              onClick={handleGeolocate}
              disabled={loading}
              className="bg-red-700 hover:bg-red-800 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Finding your representatives...
                </span>
              ) : (
                "Find My Representatives"
              )}
            </button>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm max-w-md mx-auto">
                {error}
              </div>
            )}

            <p className="mt-6 text-stone-400 text-xs">
              We use your browser location to identify your Ohio state legislative
              districts via the U.S. Census Bureau. Your location data is not stored.
            </p>
          </div>
        )}

        {/* Step 2: Review recipients and compose */}
        {step === "review" && lookupData && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">
              Your Representatives
            </h2>

            {/* Recipient cards */}
            <div className="grid gap-3 mb-8">
              {getRecipients().map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-white border border-stone-200 rounded-lg px-5 py-4 shadow-sm"
                >
                  {r.photo && (
                    <img
                      src={r.photo}
                      alt={r.name}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-stone-200"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900">{r.name}</div>
                    <div className="text-sm text-stone-500">{r.role}</div>
                  </div>
                  <div className="text-sm text-stone-400 hidden sm:block">{r.email}</div>
                </div>
              ))}
            </div>

            {/* Sender info form */}
            <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm mb-6">
              <h3 className="font-semibold text-lg mb-4">Your Information</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-stone-300 rounded-md px-4 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full border border-stone-300 rounded-md px-4 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Home Address
                  </label>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={(e) => setSenderAddress(e.target.value)}
                    placeholder="123 Main St, Cincinnati"
                    className="w-full border border-stone-300 rounded-md px-4 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    value={senderZip}
                    onChange={(e) => setSenderZip(e.target.value)}
                    placeholder="45202"
                    className="w-full border border-stone-300 rounded-md px-4 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Preview toggle */}
            <div className="mb-6">
              <button
                onClick={() => setEmailPreview(!emailPreview)}
                className="text-sm text-red-700 hover:text-red-900 font-medium underline underline-offset-2"
              >
                {emailPreview ? "Hide email preview" : "Preview the email that will be sent"}
              </button>
              {emailPreview && (
                <div className="mt-3 bg-stone-100 border border-stone-200 rounded-lg p-5">
                  <pre className="whitespace-pre-wrap text-sm text-stone-700 font-sans leading-relaxed">
                    {previewEmailBody()}
                  </pre>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSendEmails}
                disabled={sending}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white font-semibold px-6 py-3.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-center"
              >
                {sending ? "Sending..." : "Send Emails Now"}
              </button>
              <a
                href={getMailtoLink()}
                className="flex-1 bg-white hover:bg-stone-50 text-stone-700 font-semibold px-6 py-3.5 rounded-lg border border-stone-300 transition-colors text-center shadow-sm"
              >
                Open in My Email App
              </a>
            </div>

            <button
              onClick={() => {
                setStep("locate");
                setLookupData(null);
                setError(null);
              }}
              className="mt-4 text-sm text-stone-400 hover:text-stone-600 w-full text-center"
            >
              Start over with a different location
            </button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">Emails Sent!</h2>
            <p className="text-stone-600 mb-2">{sendResult}</p>
            <p className="text-stone-500 text-sm mb-8 max-w-md mx-auto">
              Your voice matters. Share this page with friends, family, and
              coworkers across Ohio to amplify the pressure on leadership.
            </p>

            {/* Share buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={() => {
                  const url = window.location.href;
                  const text =
                    "Ohio legislators can override DeWine's SB 56 veto — the votes exist. Leadership just needs to bring it to the floor. Contact your reps:";
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      text
                    )}&url=${encodeURIComponent(url)}`,
                    "_blank"
                  );
                }}
                className="px-6 py-2.5 bg-stone-800 text-white rounded-lg font-medium hover:bg-stone-900 transition-colors"
              >
                Share on X
              </button>
              <button
                onClick={() => {
                  const url = window.location.href;
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      url
                    )}`,
                    "_blank"
                  );
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Share on Facebook
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
                className="px-6 py-2.5 bg-white text-stone-700 border border-stone-300 rounded-lg font-medium hover:bg-stone-50 transition-colors"
              >
                Copy Link
              </button>
            </div>

            <button
              onClick={() => {
                setStep("locate");
                setLookupData(null);
                setSenderName("");
                setSenderEmail("");
                setSenderAddress("");
                setSenderZip("");
                setSendResult(null);
                setError(null);
              }}
              className="text-sm text-stone-400 hover:text-stone-600"
            >
              Send more emails from a different location
            </button>
          </div>
        )}
      </main>

      {/* Facts section */}
      <section className="bg-white border-t border-stone-200">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-xl font-bold mb-6 text-center">The Facts</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-700 mb-2">15</div>
              <div className="text-sm text-stone-600">
                Pages of legislation deleted by DeWine&apos;s line-item veto
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-700 mb-2">17</div>
              <div className="text-sm text-stone-600">
                Sections of SB 56 stripped from the bill
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-700 mb-2">5mg</div>
              <div className="text-sm text-stone-600">
                Low-dose THC beverages that would have been regulated — not banned
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-800 text-stone-400">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm">
          <p className="mb-2">
            This is a civic engagement tool. Your location is used solely to identify
            your state legislative districts and is not stored or shared.
          </p>
          <p>
            District data provided by the U.S. Census Bureau. Legislator information
            from the Ohio General Assembly.
          </p>
        </div>
      </footer>
    </div>
  );
}
