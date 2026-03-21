import { NextRequest, NextResponse } from "next/server";
import { getHouseRep, getSenator, LEADERSHIP } from "@/data/legislators";

// Census Bureau Geocoder - geocode an address then get districts
async function geocodeAndLookup(address: string) {
  // Step 1: Geocode the address to get coordinates
  const geocodeUrl = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"
  );
  geocodeUrl.searchParams.set("address", address);
  geocodeUrl.searchParams.set("benchmark", "Public_AR_Current");
  geocodeUrl.searchParams.set("vintage", "Current_Current");
  geocodeUrl.searchParams.set("layers", "all");
  geocodeUrl.searchParams.set("format", "json");

  const res = await fetch(geocodeUrl.toString(), {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Census geocoder request failed");

  const data = await res.json();
  const matches = data?.result?.addressMatches;

  if (!matches || matches.length === 0) {
    return { error: "no_match" };
  }

  const match = matches[0];
  const geographies = match?.geographies;
  const stateCode = match?.addressComponents?.state;

  if (stateCode !== "OH" && stateCode !== "39") {
    // Check geography data too
    const geoKeys = Object.keys(geographies || {});
    const stateKey = geoKeys.find((k) => k.includes("States"));
    const stateGeo = stateKey ? geographies[stateKey]?.[0] : null;
    if (stateGeo?.STATE !== "39") {
      return { error: "not_ohio" };
    }
  }

  if (!geographies) {
    throw new Error("No geographies returned");
  }

  const geoKeys = Object.keys(geographies);
  const lowerKey = geoKeys.find(
    (k) => k.includes("State Legislative Districts") && k.includes("Lower")
  );
  const upperKey = geoKeys.find(
    (k) => k.includes("State Legislative Districts") && k.includes("Upper")
  );

  const stateLower = lowerKey ? geographies[lowerKey]?.[0] : null;
  const stateUpper = upperKey ? geographies[upperKey]?.[0] : null;

  const houseDistrict = stateLower
    ? parseInt(stateLower.SLDLST || stateLower.BASENAME || "0", 10)
    : null;
  const senateDistrict = stateUpper
    ? parseInt(stateUpper.SLDUST || stateUpper.BASENAME || "0", 10)
    : null;

  return {
    houseDistrict: houseDistrict && houseDistrict > 0 ? houseDistrict : null,
    senateDistrict:
      senateDistrict && senateDistrict > 0 ? senateDistrict : null,
    matchedAddress: match?.matchedAddress,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || address.trim().length < 3) {
    return NextResponse.json(
      { error: "Please enter a valid Ohio address or zip code" },
      { status: 400 }
    );
  }

  try {
    // Append ", Ohio" if not already present to help geocoding
    const searchAddress = address.toLowerCase().includes("ohio") || address.toLowerCase().includes("oh")
      ? address
      : `${address}, Ohio`;

    const result = await geocodeAndLookup(searchAddress);

    if ("error" in result) {
      if (result.error === "not_ohio") {
        return NextResponse.json(
          { error: "not_ohio", message: "This address does not appear to be in Ohio." },
          { status: 400 }
        );
      }
      if (result.error === "no_match") {
        return NextResponse.json(
          { error: "no_match", message: "Could not find that address. Please try a full street address with city and state (e.g. 123 Main St, Cincinnati, OH)." },
          { status: 400 }
        );
      }
    }

    const { houseDistrict, senateDistrict } = result as {
      houseDistrict: number | null;
      senateDistrict: number | null;
    };

    const houseRep = houseDistrict ? getHouseRep(houseDistrict) : null;
    const senator = senateDistrict ? getSenator(senateDistrict) : null;

    return NextResponse.json({
      houseDistrict,
      senateDistrict,
      houseRep,
      senator,
      leadership: LEADERSHIP,
    });
  } catch (err) {
    console.error("Address lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up your address. Please try again." },
      { status: 500 }
    );
  }
}
