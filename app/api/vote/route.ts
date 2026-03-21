import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://psdjlhlqtlkeitmuszmb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZGpsaGxxdGxrZWl0bXVzem1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODkzODUsImV4cCI6MjA4OTY2NTM4NX0.830QsU4rN2204zl9cOgK2tGD2oyj9f0zav8_v_Tn6HM";

// Map Ohio House districts to 5 regions based on the Ohio regional map
// NW (Orange): Toledo, Lima, Findlay, Bowling Green area
// NE (Blue): Cleveland, Akron, Canton, Youngstown area
// Central (Red): Columbus, Delaware, Marion, Springfield area
// SW (Gold): Cincinnati, Dayton, Hamilton area
// SE (Green): Athens, Chillicothe, Zanesville, Portsmouth area
function getRegion(houseDistrict: number | null): string {
  if (!houseDistrict) return "Central";

  // NW Ohio: Williams, Fulton, Lucas, Ottawa, Defiance, Henry, Wood, Sandusky, Erie,
  // Paulding, Putnam, Hancock, Seneca, Huron, Van Wert, Allen, Mercer, Auglaize
  const nw = [41, 42, 43, 75, 76, 78, 79, 80, 81, 82, 83, 84, 85, 87, 88, 89];

  // NE Ohio: Lake, Ashtabula, Geauga, Cuyahoga, Lorain, Portage, Trumbull,
  // Medina, Summit, Mahoning, Wayne, Stark, Columbiana, Carroll
  const ne = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 47, 48, 49, 50, 51, 52, 53, 54, 56, 57, 58, 59, 64, 96, 97, 98, 99];

  // Central Ohio: Franklin, Delaware, Union, Marion, Morrow, Knox, Licking,
  // Fairfield, Pickaway, Madison, Fayette, Logan, Champaign, Clark, Shelby,
  // Hardin, Wyandot, Crawford, Ashland, Richland, Holmes, Tuscarawas, Coshocton
  const central = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 60, 61, 67, 68, 69, 70, 71, 72, 73, 86];

  // SW Ohio: Hamilton, Butler, Warren, Clermont, Brown, Clinton, Highland,
  // Greene, Montgomery, Miami, Preble, Darke
  const sw = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 44, 45, 46, 55, 74, 77];

  // SE Ohio: Athens, Meigs, Gallia, Lawrence, Scioto, Pike, Jackson, Vinton,
  // Hocking, Perry, Morgan, Noble, Monroe, Washington, Belmont, Guernsey, Muskingum, Ross, Adams
  const se = [62, 63, 65, 66, 90, 91, 92, 93, 94, 95];

  if (nw.includes(houseDistrict)) return "NW";
  if (ne.includes(houseDistrict)) return "NE";
  if (central.includes(houseDistrict)) return "Central";
  if (se.includes(houseDistrict)) return "SE";
  if (sw.includes(houseDistrict)) return "SW";
  return "Central";
}

// POST - Record a vote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { houseDistrict, senateDistrict, zip, senderName, senderEmail, senderAddress } = body;
    const quadrant = getRegion(houseDistrict);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/sb56_votes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        house_district: houseDistrict,
        senate_district: senateDistrict,
        quadrant,
        zip: zip || null,
        sender_name: senderName || null,
        sender_email: senderEmail || null,
        sender_address: senderAddress || null,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase insert error:", err);
      return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
    }

    return NextResponse.json({ success: true, quadrant });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}

// GET - Fetch vote counts
export async function GET() {
  try {
    // Get total count
    const totalRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sb56_votes?select=id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      }
    );

    const totalCount = parseInt(totalRes.headers.get("content-range")?.split("/")[1] || "0");

    // Get counts by region
    const regions = ["NW", "NE", "Central", "SW", "SE"];
    const regionCounts: Record<string, number> = {};

    for (const r of regions) {
      const rRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sb56_votes?quadrant=eq.${r}&select=id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "count=exact",
            Range: "0-0",
          },
        }
      );
      regionCounts[r] = parseInt(rRes.headers.get("content-range")?.split("/")[1] || "0");
    }

    return NextResponse.json({
      total: totalCount,
      regions: regionCounts,
      goal: 1000,
    });
  } catch (err) {
    console.error("Vote count error:", err);
    return NextResponse.json({ total: 0, regions: { NW: 0, NE: 0, Central: 0, SW: 0, SE: 0 }, goal: 1000 });
  }
}
