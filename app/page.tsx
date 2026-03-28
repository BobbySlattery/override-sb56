"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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
  const [senderCity, setSenderCity] = useState("");
  const [senderZip, setSenderZip] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [manualAddress, setManualAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState(false);
  const [voteData, setVoteData] = useState<{ total: number; regions: Record<string, number>; goal: number }>({ total: 0, regions: { NW: 0, NE: 0, Central: 0, SW: 0, SE: 0 }, goal: 15000 });
  const [showSimple, setShowSimple] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizLocation, setBizLocation] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizContact, setBizContact] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizType, setBizType] = useState("");
  const [bizAgree, setBizAgree] = useState(false);
  const [bizSubmitting, setBizSubmitting] = useState(false);
  const [bizResult, setBizResult] = useState<string | null>(null);
  const [showBizForm, setShowBizForm] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const joinRef = useRef<HTMLElement>(null);

  // Scroll to results when step changes
  useEffect(() => {
    if (step === "review" || step === "done") {
      setTimeout(() => {
        mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [step]);

  // Fetch vote counts on load and poll every 5 seconds
  useEffect(() => {
    const fetchVotes = () => fetch("/api/vote").then(r => r.json()).then(setVoteData).catch(() => {});
    fetchVotes();
    const interval = setInterval(fetchVotes, 5000);
    return () => clearInterval(interval);
  }, []);

  // Animated ticker: smoothly count up to the real total
  const [displayTotal, setDisplayTotal] = useState(0);
  useEffect(() => {
    if (voteData.total === 0) return;
    const start = displayTotal;
    const end = voteData.total;
    if (start === end) return;
    const duration = 1200;
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayTotal(Math.round(start + (end - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [voteData.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // If URL has #action hash, scroll to Join the Fight section (no auto-geolocation)
  useEffect(() => {
    if (window.location.hash === "#action") {
      setTimeout(() => {
        joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doLookup = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_ohio") {
          setError("This tool is for Ohio residents only. If you are accessing from outside Ohio, please enter your home address below and we\u2019ll connect you with your representative.");
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
      (pos) => doLookup(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access was denied. Try entering your address manually below instead.");
        } else {
          setError("Could not determine your location. Try entering your address manually below instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [doLookup]);

  const handleAddressLookup = useCallback(async () => {
    if (!manualAddress.trim()) {
      setError("Please enter your address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup-address?address=${encodeURIComponent(manualAddress.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Could not find that address.");
        return;
      }
      setLookupData(data);
      setStep("review");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [manualAddress]);

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
    if (rep) list.push({ name: rep.name, email: rep.email, role: `Your State Representative (District ${lookupData.houseDistrict})`, photo: rep.photo || "" });
    if (sen) list.push({ name: sen.name, email: sen.email, role: `Your State Senator (District ${lookupData.senateDistrict})`, photo: sen.photo || "" });
    list.push({ name: spk.name, email: spk.email, title: spk.title, role: "Speaker of the Ohio House", photo: spk.photo || "" });
    list.push({ name: pres.name, email: pres.email, title: pres.title, role: "President of the Ohio Senate", photo: pres.photo || "" });
    return list;
  };

  const handleSendEmails = async () => {
    if (!senderName.trim() || !senderEmail.trim() || !senderAddress.trim() || !senderCity.trim() || !senderZip.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSending(true);
    setError(null);
    const fullAddress = `${senderAddress.trim()}, ${senderCity.trim()}`;
    const recipients = getRecipients().map((r) => ({ name: r.name, email: r.email, title: r.title }));
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName: senderName.trim(), senderEmail: senderEmail.trim(), senderAddress: fullAddress, senderZip: senderZip.trim(), recipients, houseDistrict: lookupData?.houseDistrict, senateDistrict: lookupData?.senateDistrict }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult(data.message);
        setStep("done");
        // Record the vote
        fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ houseDistrict: lookupData?.houseDistrict, senateDistrict: lookupData?.senateDistrict, zip: senderZip.trim(), senderName: senderName.trim(), senderEmail: senderEmail.trim(), senderAddress: fullAddress, optIn }),
        }).then(r => r.json()).then(() => {
          fetch("/api/vote").then(r => r.json()).then(setVoteData).catch(() => {});
        }).catch(() => {});
      }
      else setError(data.error || "Failed to send emails. Please try the mailto option below.");
    } catch { setError("Network error sending emails. Please try the mailto option below."); }
    finally { setSending(false); }
  };

  const getMailtoLink = () => {
    const recipients = getRecipients();
    const toEmails = recipients.map((r) => r.email).join(",");
    const subject = encodeURIComponent("Override Governor DeWine\u2019s Line-Item Veto of SB 56 THC Beverage Provisions");
    const districtLine = lookupData?.houseDistrict && lookupData?.senateDistrict
      ? `As a resident of Ohio House District ${lookupData.houseDistrict} and Senate District ${lookupData.senateDistrict}`
      : "As an Ohio resident";
    const body = encodeURIComponent(`Dear Ohio Legislators,

${districtLine}${senderAddress ? ` at ${senderAddress}, ${senderCity}, ${senderZip}` : ""}, I am writing to urge you to bring Governor DeWine\u2019s line-item veto of Senate Bill 56\u2019s THC beverage provisions to an override vote immediately.

The Ohio General Assembly passed SB 56 with strong bipartisan support, including carefully crafted provisions that would have allowed the regulated sale of low-dose (5mg) THC-infused beverages through December 31, 2026. Governor DeWine\u2019s line-item veto stripped 15 pages and 17 sections from the bill \u2014 fundamentally changing what the legislature voted on.

Ohio\u2019s craft breweries, small businesses, and hemp beverage manufacturers invested in good faith based on the regulatory framework the legislature created. The veto has put hundreds of jobs and millions in investment at risk overnight.

I respectfully ask that you publicly call for and support bringing the override vote to the floor.

Sincerely,
${senderName || "[Your Name]"}
${senderAddress || "[Your Address]"}
${senderCity || "[Your City]"}, Ohio ${senderZip || "[Your Zip]"}`);
    return `mailto:${toEmails}?subject=${subject}&body=${body}`;
  };

  const previewEmailBody = () => {
    const districtLine = lookupData?.houseDistrict && lookupData?.senateDistrict
      ? `As a resident of Ohio House District ${lookupData.houseDistrict} and Senate District ${lookupData.senateDistrict}`
      : "As an Ohio resident";
    return `Dear [Legislator Name],

${districtLine}${senderAddress ? ` at ${senderAddress}, ${senderCity}, ${senderZip}` : ""}, I am writing to urge you to bring Governor DeWine\u2019s line-item veto of Senate Bill 56\u2019s THC beverage provisions to an override vote immediately.

The Ohio General Assembly passed SB 56 with strong bipartisan support, including carefully crafted provisions that would have allowed the regulated sale of low-dose (5mg) THC-infused beverages through December 31, 2026. Governor DeWine\u2019s line-item veto stripped 15 pages and 17 sections from the bill \u2014 fundamentally changing what the legislature voted on. This was not a surgical line-item veto of an appropriation; it was a wholesale rewrite of policy that the legislature had deliberated and approved.

This matters because:

- Ohio\u2019s craft breweries, small businesses, and hemp beverage manufacturers invested in good faith based on the regulatory framework the legislature created. The veto has put hundreds of jobs and millions in investment at risk overnight.

- The legislature \u2014 not the Governor \u2014 sets policy in Ohio. Allowing this overreach to stand sets a dangerous precedent for executive power over the legislative process.

I respectfully ask that you publicly call for and support bringing the override vote to the floor of both the House and Senate. Ohio\u2019s small businesses, workers, and the integrity of the legislative process depend on it.

Thank you for your service to our state. I look forward to your response.

Sincerely,
${senderName || "[Your Name]"}
${senderAddress || "[Your Address]"}
${senderCity || "[Your City]"}, Ohio ${senderZip || "[Your Zip]"}`;
  };

  // Wavy SVG divider
  const WaveDivider = ({ flip, color }: { flip?: boolean; color: string }) => (
    <div className={flip ? "rotate-180" : ""}>
      <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block" preserveAspectRatio="none" style={{ height: "60px" }}>
        <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" fill={color} />
      </svg>
    </div>
  );

  const inputClass = "w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white";

  return (
    <div className="min-h-screen bg-white overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Brewery logo strip */}
      <div className="bg-white py-5 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          {/* Top row — 9 logos */}
          <div className="flex justify-center items-center gap-3 md:gap-7">
            <img src="/images/logo-urbanartifact.png" alt="Urban Artifact" className="h-8 md:h-16" />
            <img src="/images/Rambling.png" alt="Rambling" className="h-8 md:h-16" />
            <img src="/images/NineGiant.png" alt="Nine Giant" className="h-8 md:h-16" />
            <img src="/images/ThirdEye.png" alt="Third Eye Brewing" className="h-8 md:h-16" />
            <img src="/images/LandGrantLogo.png" alt="Land Grant" className="h-8 md:h-16" />
            <img src="/images/WolfsRidge.png" alt="Wolf's Ridge" className="h-10 md:h-20" />
            <img src="/images/SaucyLogo.PNG" alt="Saucy Brew Works" className="h-10 md:h-20" />
            <img src="/images/MadTreeLogo.png" alt="MadTree Brewing" className="h-10 md:h-20" />
            <img src="/images/JuniperLogo.png" alt="Juniper Brewing Co" className="h-7 md:h-14" />
          </div>
          {/* Bottom row — 5 center logos */}
          <div className="flex justify-center items-center gap-4 md:gap-10 mt-3 md:mt-4">
            <img src="/images/4Rhine.png" alt="Rhinegeist" className="h-10 md:h-20" />
            <img src="/images/logo-greatlakes.png" alt="Great Lakes Brewing" className="h-10 md:h-20" />
            <img src="/images/logo-fiftywest.png" alt="Fifty West" className="h-12 md:h-24" />
            <img src="/images/logo-jackios.png" alt="Jackie O's" className="h-10 md:h-18" />
            <img src="/images/logo-seventhson.png" alt="Seventh Son" className="h-10 md:h-20" />
          </div>
        </div>
      </div>

      {/* Hero */}
      <header style={{ background: "linear-gradient(135deg, #F7A51C 0%, #E8941A 50%, #F7A51C 100%)" }} className="text-white relative overflow-hidden">

        <div className="max-w-5xl mx-auto px-6 py-10 relative z-10">

          <div className="text-center mb-8">
            <div className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.8)" }}>
              Ohio Senate Bill 56
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
              Override the Veto.
              <br />
              <span className="text-gray-900">Save Our Beverages.</span>
              <br />
              <span className="text-gray-900">Save Our Jobs.</span>
              <br />
              <span className="text-gray-900">Save Ohio.</span>
            </h1>
            <p className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
              Governor DeWine line-item vetoed 15 pages of SB 56 — killing the THC
              beverage provisions the legislature passed with bipartisan support.
              <strong className="text-white block mt-2 text-xl md:text-2xl">
                The votes to override exist. Leadership needs to bring it to the floor.
              </strong>
            </p>
          </div>

          {/* Brewery worker photos - seamless collage */}
          <div className="relative max-w-4xl mx-auto" style={{ height: "280px" }}>
            <img src="/images/worker-1.jpg" alt="Brewery workers" className="absolute left-0 top-2 w-40 h-52 object-cover rounded-2xl shadow-xl -rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 border-4 border-white/30" />
            <img src="/images/workers-2.jpg" alt="Brewery workers" className="absolute left-32 top-8 w-40 h-52 object-cover rounded-2xl shadow-xl rotate-2 hover:rotate-0 hover:scale-105 transition-all duration-300 border-4 border-white/30 z-10" />
            <img src="/images/thankyou.jpg" alt="Brewery team" className="absolute left-1/2 -translate-x-1/2 top-0 w-64 h-48 object-cover rounded-2xl shadow-xl -rotate-1 hover:rotate-0 hover:scale-105 transition-all duration-300 border-4 border-white/30 z-20" style={{ objectPosition: "center 60%" }} />
            <img src="/images/keg.jpg" alt="Brewery worker with keg" className="absolute right-32 top-6 w-40 h-52 object-cover rounded-2xl shadow-xl rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 border-4 border-white/30 z-10" />
            <img src="/images/workers-3.jpg" alt="Brewery workers" className="absolute right-0 top-2 w-40 h-52 object-cover rounded-2xl shadow-xl -rotate-2 hover:rotate-0 hover:scale-105 transition-all duration-300 border-4 border-white/30" />
          </div>

        </div>
      </header>

      {/* Join the Fight - above What Happened */}
      <section className="bg-white" ref={joinRef}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          {step === "locate" && (
            <div className="text-center">
              <h2 className="text-3xl font-extrabold mb-3 text-gray-900">
                Join the Fight
              </h2>
              <p className="text-gray-500 mb-8 max-w-xl mx-auto text-lg">
                We&apos;ll identify your Ohio State House Rep and Senator, then send them
                — along with Speaker Huffman and Senate President McColley — a message
                urging them to bring the override vote to the floor.
              </p>

              <button
                onClick={handleGeolocate}
                disabled={loading}
                className="text-white font-bold px-10 py-4 rounded-full text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105"
                style={{ backgroundColor: "#F7A51C" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#DE9419")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F7A51C")}
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Finding your representatives...
                  </span>
                ) : (
                  "Make My Voice Heard"
                )}
              </button>

              <div className="mt-8 max-w-md mx-auto">
                <p className="text-gray-400 text-sm mb-3">Or enter your Ohio address:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddressLookup(); }}
                    placeholder="123 Main St, Cincinnati, OH 45202"
                    className={inputClass}
                  />
                  <button
                    onClick={handleAddressLookup}
                    disabled={loading}
                    className="text-white font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                    style={{ backgroundColor: "#F7A51C" }}
                  >
                    Go
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-6 rounded-xl p-4 text-sm max-w-md mx-auto" style={{ backgroundColor: "#FEF2F2", color: "#A42325", border: "1px solid #FECACA" }}>
                  {error}
                </div>
              )}

              <p className="mt-6 text-gray-400 text-xs">
                We use the U.S. Census Bureau to identify your Ohio state legislative
                districts. Your data is not stored.
              </p>
            </div>
          )}
        </div>
      </section>

      <WaveDivider color="#FFF7ED" />

      {/* Info Bar */}
      <div style={{ backgroundColor: "#FFF7ED" }}>
        <div className="max-w-3xl mx-auto px-6 py-8 text-center" style={{ color: "#92400E" }}>
          <h2 className="text-3xl font-extrabold mb-4" style={{ color: "#92400E" }}>What Happened?</h2>
          <p className="text-sm">Ohio lawmakers in the House and Senate did the work to create clear, common-sense rules for low-dose (5mg) THC beverages through Senate Bill 56. The bill established strict manufacturing oversight, required sales only to those 21 and older, and limited distribution to licensed establishments. It was a bipartisan effort shaped with input from regulators and industry leaders to bring an existing market into a safe, controlled system. However, when the bill reached Governor DeWine&apos;s desk, he used a line-item veto to remove all language in the bill pertaining to beverage provisions, effectively nullifying the intent of both the House and Senate. Now, the only way to restore what lawmakers already approved is for legislative leaders to bring an override vote to the floor.</p>
          <button
            onClick={() => setShowSimple(!showSimple)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#92400E", color: "#FFF7ED" }}
          >
            {showSimple ? "Show Full Explanation" : "Explain It Simply"}
          </button>
          {showSimple && (
            <div className="mt-4 p-4 rounded-xl text-sm text-left" style={{ backgroundColor: "#FDEBD0", color: "#92400E" }}>
              The people who make the rules in Ohio worked together to make a plan so THC drinks would be made safely, only sold to adults, and only in places that already follow rules. Everyone agreed on the plan. But when it got to the governor for his signature, he crossed out the part about the drinks. Now, the only way to fix it is for the rule-makers to vote again, but the two leaders of the rule-makers have to say &quot;yes&quot; before everyone else is allowed to vote.
            </div>
          )}
        </div>
      </div>

      <WaveDivider flip color="#FFF7ED" />

      {/* Vote Counter + Ohio Map */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          {/* Big total number */}
          <div className="text-center mb-2">
            <div className="text-6xl md:text-8xl font-extrabold" style={{ color: "#F7A51C" }}>
              {displayTotal.toLocaleString()}
            </div>
            <div className="text-xl md:text-2xl font-bold text-gray-700 mt-1">
              Ohioans demanding Senate President Rob McColley and Speaker of the House Matt Huffman bring the veto override to vote
            </div>
            <div className="text-sm text-gray-400 mt-1">Goal: {voteData.goal.toLocaleString()}</div>
          </div>

          {/* Progress bar */}
          <div className="max-w-md mx-auto mb-10">
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min((displayTotal / voteData.goal) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #F7A51C, #E8941A)",
                }}
              />
            </div>
          </div>

          {/* Ohio map with 5 regions */}
          <div className="relative max-w-md mx-auto">
            <img src="/images/OhioMap.jpg" alt="Ohio Regions Map" className="w-full" />
            {/* Vote count overlays positioned over each region */}
            {/* NW Ohio (top-left) */}
            <div className="absolute text-center" style={{ top: "24%", left: "28%", transform: "translate(-50%, -50%)" }}>
              <div className="font-extrabold text-2xl md:text-3xl" style={{ color: "#E8941A" }}>{voteData.regions.NW || 0}</div>
              <div className="text-gray-700 text-xs font-bold">supporters</div>
            </div>
            {/* NE Ohio (top-right) */}
            <div className="absolute text-center" style={{ top: "28%", left: "73%", transform: "translate(-50%, -50%)" }}>
              <div className="font-extrabold text-2xl md:text-3xl" style={{ color: "#E8941A" }}>{voteData.regions.NE || 0}</div>
              <div className="text-gray-700 text-xs font-bold">supporters</div>
            </div>
            {/* Central Ohio (middle) */}
            <div className="absolute text-center" style={{ top: "50%", left: "45%", transform: "translate(-50%, -50%)" }}>
              <div className="font-extrabold text-2xl md:text-3xl" style={{ color: "#E8941A" }}>{voteData.regions.Central || 0}</div>
              <div className="text-gray-700 text-xs font-bold">supporters</div>
            </div>
            {/* SW Ohio (bottom-left) */}
            <div className="absolute text-center" style={{ top: "66%", left: "18%", transform: "translate(-50%, -50%)" }}>
              <div className="font-extrabold text-2xl md:text-3xl" style={{ color: "#E8941A" }}>{voteData.regions.SW || 0}</div>
              <div className="text-gray-700 text-xs font-bold">supporters</div>
            </div>
            {/* SE Ohio (bottom-right) */}
            <div className="absolute text-center" style={{ top: "58%", left: "78%", transform: "translate(-50%, -50%)" }}>
              <div className="font-extrabold text-2xl md:text-3xl" style={{ color: "#E8941A" }}>{voteData.regions.SE || 0}</div>
              <div className="text-gray-700 text-xs font-bold">supporters</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main ref={mainRef} className="max-w-3xl mx-auto px-6 py-12">
        {/* Step 1: Locate */}
        {step === "locate" && (
          <div className="text-center">
            <h2 className="text-3xl font-extrabold mb-3 text-gray-900">
              Join the Fight
            </h2>
            <p className="text-gray-500 mb-8 max-w-xl mx-auto text-lg">
              We&apos;ll identify your Ohio State House Rep and Senator, then send them
              — along with Speaker Huffman and Senate President McColley — a message
              urging them to bring the override vote to the floor.
            </p>

            <button
              onClick={handleGeolocate}
              disabled={loading}
              className="text-white font-bold px-10 py-4 rounded-full text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105"
              style={{ backgroundColor: "#F7A51C" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#DE9419")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F7A51C")}
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Finding your representatives...
                </span>
              ) : (
                "Make My Voice Heard"
              )}
            </button>

            <div className="mt-8 max-w-md mx-auto">
              <p className="text-gray-400 text-sm mb-3">Or enter your Ohio address:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddressLookup(); }}
                  placeholder="123 Main St, Cincinnati, OH 45202"
                  className={inputClass}
                />
                <button
                  onClick={handleAddressLookup}
                  disabled={loading}
                  className="text-white font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: "#F7A51C" }}
                >
                  Go
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-xl p-4 text-sm max-w-md mx-auto" style={{ backgroundColor: "#FEF2F2", color: "#A42325", border: "1px solid #FECACA" }}>
                {error}
              </div>
            )}

            <p className="mt-6 text-gray-400 text-xs">
              We use the U.S. Census Bureau to identify your Ohio state legislative
              districts. Your data is not stored.
            </p>
          </div>
        )}

        {/* Step 2: Review recipients and compose */}
        {step === "review" && lookupData && (
          <div>
            <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-900">
              Your Representatives
            </h2>

            {/* Recipient cards */}
            <div className="grid gap-3 mb-8">
              {getRecipients().map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl px-5 py-4 shadow-sm transition-all hover:shadow-md"
                  style={{ backgroundColor: "#FFF7ED", border: "2px solid #FDE68A" }}
                >
                  {r.photo && (
                    <img
                      src={r.photo}
                      alt={r.name}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                      style={{ border: "3px solid #F7A51C" }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-lg">{r.name}</div>
                    <div className="text-sm" style={{ color: "#92400E" }}>{r.role}</div>
                  </div>
                  <div className="text-sm text-gray-400 hidden sm:block">{r.email}</div>
                </div>
              ))}
            </div>

            {/* Sender info form */}
            <div className="rounded-2xl p-6 shadow-sm mb-6" style={{ backgroundColor: "#FFFBEB", border: "2px solid #FDE68A" }}>
              <h3 className="font-bold text-lg mb-4 text-gray-900">Your Information</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Jane Smith" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                  <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="jane@example.com" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Home Address</label>
                  <input type="text" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="123 Main St" className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                    <input type="text" value={senderCity} onChange={(e) => setSenderCity(e.target.value)} placeholder="Cincinnati" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Zip Code</label>
                    <input type="text" value={senderZip} onChange={(e) => setSenderZip(e.target.value)} placeholder="45202" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview toggle */}
            <div className="mb-6">
              <button onClick={() => setEmailPreview(!emailPreview)} className="text-sm font-semibold underline underline-offset-2" style={{ color: "#B45309" }}>
                {emailPreview ? "Hide email preview" : "Preview the email that will be sent"}
              </button>
              {emailPreview && (
                <div className="mt-3 rounded-xl p-5" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FDE68A" }}>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{previewEmailBody()}</pre>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "#FEF2F2", color: "#A42325", border: "1px solid #FECACA" }}>
                {error}
              </div>
            )}

            {/* Opt-in checkbox */}
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-orange-500"
                />
                <span className="text-sm text-gray-600">Keep me updated on the SaveOhioBevs campaign</span>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSendEmails}
                disabled={sending}
                className="flex-1 text-white font-bold px-6 py-4 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 text-center text-lg"
                style={{ backgroundColor: "#F7A51C" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#DE9419")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F7A51C")}
              >
                {sending ? "Sending..." : "Send Emails Now"}
              </button>
              <a
                href={(!senderName.trim() || !senderEmail.trim() || !senderAddress.trim() || !senderCity.trim() || !senderZip.trim()) ? "#" : getMailtoLink()}
                onClick={(e) => {
                  if (!senderName.trim() || !senderEmail.trim() || !senderAddress.trim() || !senderCity.trim() || !senderZip.trim()) {
                    e.preventDefault();
                    setError("Please fill in your name, email, address, city, and zip code above.");
                    return;
                  }
                  const fullAddr = `${senderAddress.trim()}, ${senderCity.trim()}`;
                  fetch("/api/vote", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ houseDistrict: lookupData?.houseDistrict, senateDistrict: lookupData?.senateDistrict, zip: senderZip.trim(), senderName: senderName.trim(), senderEmail: senderEmail.trim(), senderAddress: fullAddr, optIn }),
                  }).then(() => fetch("/api/vote").then(r => r.json()).then(setVoteData).catch(() => {})).catch(() => {});
                }}
                className="flex-1 font-bold px-6 py-4 rounded-full transition-all text-center text-lg hover:shadow-md"
                style={{ backgroundColor: "white", color: "#B45309", border: "2px solid #F7A51C" }}
              >
                Open in My Email App
              </a>
            </div>

            <button
              onClick={() => { setStep("locate"); setLookupData(null); setError(null); }}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 w-full text-center"
            >
              Start over with a different location
            </button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ backgroundColor: "#D9F99D" }}>
              <svg className="w-10 h-10" style={{ color: "#65A30D" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold mb-3 text-gray-900">Emails Sent!</h2>
            <p className="text-gray-600 mb-2">{sendResult}</p>
            <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto">
              Your voice matters. Share this page with friends, family, and coworkers across Ohio to amplify the pressure on leadership.
            </p>

            {/* Share buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={() => {
                  const url = window.location.href;
                  const text = "Ohio legislators can override DeWine\u2019s SB 56 veto \u2014 the votes exist. Leadership just needs to bring it to the floor. Contact your reps:";
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
                }}
                className="px-6 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-black transition-colors"
              >
                Share on X
              </button>
              <button
                onClick={() => {
                  const url = window.location.href;
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
                }}
                className="px-6 py-3 rounded-full font-bold text-white transition-colors"
                style={{ backgroundColor: "#1877F2" }}
              >
                Share on Facebook
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="px-6 py-3 bg-white text-gray-700 rounded-full font-bold transition-colors"
                style={{ border: "2px solid #E5E7EB" }}
              >
                Copy Link
              </button>
            </div>

            <button
              onClick={() => { setStep("locate"); setLookupData(null); setSenderName(""); setSenderEmail(""); setSenderAddress(""); setSenderCity(""); setSenderZip(""); setSendResult(null); setError(null); setOptIn(true); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Send more emails from a different location
            </button>
          </div>
        )}
      </main>

      {/* Product photo strip - both brands */}
      <section className="py-8" style={{ backgroundColor: "#FFF7ED" }}>
        <h3 className="text-center font-extrabold text-xl text-gray-900 mb-6">Ohio Made Products at Risk</h3>
        {/* Grid of 4 on desktop, swipeable on mobile */}
        <div className="overflow-x-auto md:overflow-visible px-4 md:px-6 md:mx-auto max-w-3xl" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-4 md:grid md:grid-cols-4 md:gap-4 md:justify-items-center w-max md:w-auto px-2 md:px-0 pb-4 md:pb-0">
            <img src="https://cdn.shopify.com/s/files/1/0664/4229/7422/files/5_1.jpg" alt="Sunflower Seltzers" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://drinkfuzzybones.com/cdn/shop/files/blood-orange-fuzzy-bones-5.png" alt="Fuzzy Bones Blood Orange" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://cdn.shopify.com/s/files/1/0664/4229/7422/files/3_5e7367c5-4417-4241-89a7-3badcbfd1bf9.jpg" alt="Sunflower Seltzers" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://drinkfuzzybones.com/cdn/shop/files/lemon-blueberry-fuzzy-bones-5.png" alt="Fuzzy Bones Lemon Blueberry" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://thefloatshoppe.com/cdn/shop/files/LemonLimeRickey-5MG-Icon.png" alt="Float Shoppe Lemon Lime Rickey" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://cdn.shopify.com/s/files/1/0664/4229/7422/files/1_69e12bac-79b1-494d-9d0d-687fcd416453.jpg" alt="Sunflower Seltzers" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://thefloatshoppe.com/cdn/shop/files/RootBeer-5MG-Icon.png" alt="Float Shoppe Root Beer" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://drinkfuzzybones.com/cdn/shop/files/blackberry-hibiscus-fuzzy-bones-5.png" alt="Fuzzy Bones Blackberry Hibiscus" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://soberish.com/cdn/shop/files/Untitled_design_42.png" alt="Coastalo Red Cream Soda" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/greenbuddy-peach.jpg" alt="Green Buddy Peach THC Soda" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="https://soberish.com/cdn/shop/files/Untitled_design_37.png" alt="Coastalo Grape Soda" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/greenbuddy-blueberry.jpg" alt="Green Buddy Wild Blueberry THC Soda" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/JackieOs.jpg" alt="Jackie O's" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/JackieOs2.jpg" alt="Jackie O's" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/4Pack-Cans_FloatShoppe-LemonLimeRickey-5mg_2000px_4b0cf354-80a9-437c-86a0-4784619c136d.jpg" alt="Float Shoppe 4-Pack" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/Estazzi.jpeg" alt="Estazzi" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/Estazzi2.png" alt="Estazzi" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/SaucyProduct.JPG" alt="Saucy Brew Works" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/SaucyProduct2.JPG" alt="Saucy Brew Works" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
            <img src="/images/ThirdEyeCans.jpg" alt="Third Eye Brewing Cans" className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-2xl shadow-md flex-shrink-0" />
          </div>
        </div>
      </section>

      {/* Facts section */}
      <WaveDivider color="#F7A51C" />
      <section style={{ backgroundColor: "#F7A51C" }} className="relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 py-12 relative z-10">
          <h2 className="text-2xl font-extrabold mb-8 text-center text-white">The Facts</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center bg-white rounded-2xl p-6 shadow-md">
              <div className="text-4xl font-extrabold mb-2" style={{ color: "#A42325" }}>15</div>
              <div className="text-sm text-gray-600">Pages of legislation deleted by DeWine&apos;s line-item veto</div>
            </div>
            <div className="text-center bg-white rounded-2xl p-6 shadow-md">
              <div className="text-4xl font-extrabold mb-2" style={{ color: "#A42325" }}>17</div>
              <div className="text-sm text-gray-600">Sections of SB 56 stripped from the bill</div>
            </div>
            <div className="text-center bg-white rounded-2xl p-6 shadow-md">
              <div className="text-4xl font-extrabold mb-2" style={{ color: "#A42325" }}>700+</div>
              <div className="text-sm text-gray-600">Ohio Jobs affected by Governor&apos;s Actions</div>
            </div>
            <div className="text-center bg-white rounded-2xl p-6 shadow-md">
              <div className="text-4xl font-extrabold mb-2" style={{ color: "#A42325" }}>$130M</div>
              <div className="text-sm text-gray-600">Revenue impact on the state of Ohio according to the Whitney Economic Impact Study</div>
            </div>
          </div>
        </div>
      </section>
      <WaveDivider flip color="#F7A51C" />

      {/* Business Signup */}
      <section className="py-12 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold mb-3 text-center text-gray-900">Retailers &amp; Brewers</h2>
          <p className="text-gray-500 text-center text-lg">
            Want to join the cause?{" "}
            {!showBizForm && bizResult !== "success" && (
              <button
                onClick={() => setShowBizForm(true)}
                className="font-bold underline transition-colors"
                style={{ color: "#F7A51C" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#DE9419")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#F7A51C")}
              >
                Click here
              </button>
            )}
          </p>

          {bizResult === "success" ? (
            <div className="text-center rounded-2xl p-8 mt-6" style={{ backgroundColor: "#FFF7ED" }}>
              <div className="text-4xl mb-3">&#127867;</div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">You&apos;re In!</h3>
              <p className="text-gray-600">Thanks for signing up. Bobby will be in touch soon with next steps.</p>
            </div>
          ) : showBizForm ? (
            <form
              className="space-y-4 mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!bizAgree) return;
                setBizSubmitting(true);
                setBizResult(null);
                try {
                  const res = await fetch("/api/business-signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      businessName: bizName,
                      location: bizLocation,
                      phone: bizPhone,
                      contactName: bizContact,
                      contactEmail: bizEmail,
                      businessType: bizType,
                    }),
                  });
                  if (res.ok) {
                    setBizResult("success");
                  } else {
                    setBizResult("error");
                  }
                } catch {
                  setBizResult("error");
                }
                setBizSubmitting(false);
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="e.g. Fifty West Brewing"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">I am a... *</label>
                  <select
                    required
                    value={bizType}
                    onChange={(e) => setBizType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select one</option>
                    <option value="Brewery">Brewery</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location (City, State) *</label>
                <input
                  type="text"
                  required
                  value={bizLocation}
                  onChange={(e) => setBizLocation(e.target.value)}
                  placeholder="e.g. Cincinnati, OH"
                  className={inputClass}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={bizContact}
                    onChange={(e) => setBizContact(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    placeholder="you@business.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className={inputClass}
                />
              </div>

              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="bizAgree"
                  checked={bizAgree}
                  onChange={(e) => setBizAgree(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                  required
                />
                <label htmlFor="bizAgree" className="text-sm text-gray-600">
                  I approve of my business being listed as a participant in the SaveOhioBevs campaign and consent to being contacted about next steps.
                </label>
              </div>

              {bizResult === "error" && (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: "#FEF2F2", color: "#A42325", border: "1px solid #FECACA" }}>
                  Something went wrong. Please try again or email bobby@50westbrew.com directly.
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="submit"
                  disabled={bizSubmitting || !bizAgree}
                  className="text-white font-bold px-10 py-4 rounded-full text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105"
                  style={{ backgroundColor: "#F7A51C" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#DE9419")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F7A51C")}
                >
                  {bizSubmitting ? "Submitting..." : "Join the Cause"}
                </button>
              </div>
            </form>
          ) : null}

          {/* Printable Flyer Link */}
          <div className="text-center mt-6">
            <a
              href="/flyer.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2 rounded-full text-sm font-bold transition-colors"
              style={{ backgroundColor: "#F7A51C", color: "white" }}
            >
              Printable Call to Action Flyer
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm">
          <p className="mb-2">
            This is a civic engagement tool. Your location is used solely to identify
            your state legislative districts and is not stored or shared.
          </p>
          <p className="mb-3">
            District data provided by the U.S. Census Bureau. Legislator information
            from the Ohio General Assembly.
          </p>
          <p>
            <a href="/privacy" className="text-orange-400 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
