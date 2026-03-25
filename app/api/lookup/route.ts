import { NextRequest, NextResponse } from "next/server";
import { getHouseRep, getSenator, LEADERSHIP } from "@/data/legislators";

const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY;

async function getDistrictsFromCoords(lat: number, lng: number) {
  if (!GEOCODIO_API_KEY) {
    throw new Error("GEOCODIO_API_KEY is not configured");
  }

  const url = new URL("https://api.geocod.io/v1.12/reverse");
  url.searchParams.set("q", `${lat},${lng}`);
  url.searchParams.set("fields", "stateleg");
  url.searchParams.set("api_key", GEOCODIO_API_KEY);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Geocodio reverse request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const results = data?.results;

  if (!results || results.length === 0) {
    throw new Error("No results returned from Geocodio");
  }

  const result = results[0];
  const components = result?.address_components;
  const state = components?.state;

  if (state && state !== "OH") {
    return { error: "not_ohio", stateCode: state };
  }

  const stateleg = result?.fields?.state_legislative_districts;
  const houseDistrict = stateleg?.house?.[0]?.district_number
    ? parseInt(stateleg.house[0].district_number, 10)
    : null;
  const senateDistrict = stateleg?.senate?.[0]?.district_number
    ? parseInt(stateleg.senate[0].district_number, 10)
    : null;

  return {
    houseDistrict: houseDistrict && houseDistrict > 0 ? houseDistrict : null,
    senateDistrict: senateDistrict && senateDistrict > 0 ? senateDistrict : null,
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
      { error: "Failed to look up your district. Please try again.", details: String(err) },
      { status: 500 }
    );
  }
}
