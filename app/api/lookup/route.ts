import { NextRequest, NextResponse } from "next/server";
import { getHouseRep, getSenator, LEADERSHIP } from "@/data/legislators";

// Census Bureau Geocoder - returns state legislative districts from coordinates
// This is a free API with no key required
async function getDistrictsFromCoords(lat: number, lng: number) {
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
  );
  url.searchParams.set("x", lng.toString());
  url.searchParams.set("y", lat.toString());
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("layers", "all");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("Census geocoder request failed");

  const data = await res.json();
  const geographies = data?.result?.geographies;

  if (!geographies) {
    throw new Error("No geographies returned from Census geocoder");
  }

  // The Census geocoder uses year-prefixed layer names that change over time
  // Search for the correct keys dynamically
  const geoKeys = Object.keys(geographies);

  const lowerKey = geoKeys.find(
    (k) =>
      k.includes("State Legislative Districts") && k.includes("Lower")
  );
  const upperKey = geoKeys.find(
    (k) =>
      k.includes("State Legislative Districts") && k.includes("Upper")
  );
  const stateKey = geoKeys.find(
    (k) => k === "States" || k.includes("States")
  );

  const stateLower = lowerKey ? geographies[lowerKey]?.[0] : null;
  const stateUpper = upperKey ? geographies[upperKey]?.[0] : null;
  const state = stateKey ? geographies[stateKey]?.[0] : null;

  // Check if we're in Ohio (FIPS code 39)
  const stateCode = state?.STATE || stateLower?.STATE || stateUpper?.STATE;
  if (stateCode && stateCode !== "39") {
    return { error: "not_ohio", stateCode };
  }

  const houseDistrict = stateLower
    ? parseInt(stateLower.SLDLST || stateLower.BASENAME || "0", 10)
    : null;
  const senateDistrict = stateUpper
    ? parseInt(stateUpper.SLDUST || stateUpper.BASENAME || "0", 10)
    : null;

  return {
    houseDistrict: houseDistrict && houseDistrict > 0 ? houseDistrict : null,
    senateDistrict: senateDistrict && senateDistrict > 0 ? senateDistrict : null,
    debug: {
      availableLayers: geoKeys,
      lowerKey,
      upperKey,
      stateLower,
      stateUpper,
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Valid lat and lng parameters are required" },
      { status: 400 }
    );
  }

  try {
    const districts = await getDistrictsFromCoords(lat, lng);

    if ("error" in districts && districts.error === "not_ohio") {
      return NextResponse.json(
        {
          error: "not_ohio",
          message:
            "This tool is for Ohio residents. Your location does not appear to be in Ohio.",
        },
        { status: 400 }
      );
    }

    const { houseDistrict, senateDistrict, debug } = districts as {
      houseDistrict: number | null;
      senateDistrict: number | null;
      debug: Record<string, unknown>;
    };

    const houseRep = houseDistrict ? getHouseRep(houseDistrict) : null;
    const senator = senateDistrict ? getSenator(senateDistrict) : null;

    return NextResponse.json({
      houseDistrict,
      senateDistrict,
      houseRep,
      senator,
      leadership: LEADERSHIP,
      debug,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up your district. Please try again.", details: String(err) },
      { status: 500 }
    );
  }
}
