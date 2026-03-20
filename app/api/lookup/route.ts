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
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Census geocoder request failed");

  const data = await res.json();
  const geographies = data?.result?.geographies;

  // Extract state legislative districts
  const stateLower =
    geographies?.["Current State Legislative Districts - Lower"]?.[0];
  const stateUpper =
    geographies?.["Current State Legislative Districts - Upper"]?.[0];
  const state = geographies?.["States"]?.[0];

  const stateCode = state?.STATE;
  if (stateCode !== "39") {
    // 39 = Ohio FIPS code
    return { error: "not_ohio", stateCode };
  }

  const houseDistrict = stateLower ? parseInt(stateLower.SLDLST, 10) : null;
  const senateDistrict = stateUpper ? parseInt(stateLower ? stateUpper.SLDUST : "0", 10) : null;

  return { houseDistrict, senateDistrict };
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

    const { houseDistrict, senateDistrict } = districts as {
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
    console.error("Lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up your district. Please try again." },
      { status: 500 }
    );
  }
}
