import { NextRequest, NextResponse } from "next/server";
import { getHouseRep, getSenator, LEADERSHIP } from "@/data/legislators";
import { rateLimit } from "@/app/lib/rate-limit";

const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY;

async function geocodeAndLookup(address: string) {
  if (!GEOCODIO_API_KEY) {
    throw new Error("GEOCODIO_API_KEY is not configured");
  }

  const url = new URL("https://api.geocod.io/v1.12/geocode");
  url.searchParams.set("q", address);
  url.searchParams.set("fields", "stateleg");
  url.searchParams.set("api_key", GEOCODIO_API_KEY);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Geocodio request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const results = data?.results;

  if (!results || results.length === 0) {
    return { error: "no_match" };
  }

  const result = results[0];
  const components = result?.address_components;
  const state = components?.state;

  if (state && state !== "OH") {
    return { error: "not_ohio" };
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
    matchedAddress: result?.formatted_address,
  };
}

export async function GET(request: NextRequest) {
  // Rate limit: 30 address lookups per IP per minute
  const limited = rateLimit(request, "lookup-address", 30, 60 * 1000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || address.trim().length < 3) {
    return NextResponse.json(
      { error: "Please enter a valid Ohio address or zip code" },
      { status: 400 }
    );
  }

  try {
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
