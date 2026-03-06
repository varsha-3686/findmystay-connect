import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { hostel_id } = await req.json();

    // Fetch the hostel
    const { data: hostel, error: hostelErr } = await supabase
      .from("hostels")
      .select("*")
      .eq("id", hostel_id)
      .single();

    if (hostelErr || !hostel) throw new Error("Hostel not found");

    // Fetch all other hostels for comparison
    const { data: allHostels } = await supabase
      .from("hostels")
      .select("id, hostel_name, description, price_min, price_max, city, location, owner_id")
      .neq("id", hostel_id)
      .limit(500);

    // Fetch hostel images
    const { data: images } = await supabase
      .from("hostel_images")
      .select("image_url")
      .eq("hostel_id", hostel_id);

    // Fetch other images for duplicate detection
    const { data: allImages } = await supabase
      .from("hostel_images")
      .select("image_url, hostel_id")
      .neq("hostel_id", hostel_id)
      .limit(500);

    // Count listings by same owner
    const { count: ownerListingCount } = await supabase
      .from("hostels")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", hostel.owner_id);

    // Build analysis prompt
    const prompt = `Analyze this hostel listing for fraud indicators and return a risk assessment.

HOSTEL DATA:
- Name: ${hostel.hostel_name}
- Description: ${hostel.description || "No description"}
- Price range: ₹${hostel.price_min} - ₹${hostel.price_max}/month
- City: ${hostel.city}
- Location: ${hostel.location}
- Owner listing count: ${ownerListingCount}
- Number of images: ${images?.length || 0}
- Has GPS coordinates: ${hostel.latitude && hostel.longitude ? "Yes" : "No"}

CITY PRICE CONTEXT (other listings in ${hostel.city}):
${(allHostels || []).filter(h => h.city === hostel.city).map(h => `  ${h.hostel_name}: ₹${h.price_min}-${h.price_max}`).join("\n") || "No other listings"}

DUPLICATE CHECK:
- Similar names: ${(allHostels || []).filter(h => h.hostel_name.toLowerCase().includes(hostel.hostel_name.toLowerCase().split(" ")[0])).map(h => h.hostel_name).join(", ") || "None"}
- Image URLs shared with other listings: ${(allImages || []).filter(ai => (images || []).some(i => i.image_url === ai.image_url)).length}

Analyze for:
1. Price anomaly (is price abnormally low/high for the city?)
2. Duplicate images (shared URLs with other listings)
3. Description quality (generic, copied, or suspicious)
4. Missing information (no images, no GPS, no description)
5. Owner behavior (too many listings in short time)`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a fraud detection AI for a hostel marketplace. Analyze listings and return structured fraud assessments." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "fraud_assessment",
            description: "Return the fraud risk assessment for a hostel listing",
            parameters: {
              type: "object",
              properties: {
                risk_score: { type: "integer", description: "Risk score 0-100, where 100 is highest risk" },
                flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["price_anomaly", "duplicate_image", "duplicate_description", "low_price", "owner_behavior", "missing_info"] },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      description: { type: "string" },
                    },
                    required: ["type", "severity", "description"],
                  },
                },
                summary: { type: "string", description: "Brief summary of findings" },
              },
              required: ["risk_score", "flags", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fraud_assessment" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let assessment = { risk_score: 0, flags: [], summary: "Unable to assess" };
    if (toolCall?.function?.arguments) {
      try {
        assessment = JSON.parse(toolCall.function.arguments);
      } catch {
        // fallback
      }
    }

    // If risk score > 70, create a fraud alert
    if (assessment.risk_score > 70) {
      await supabase.from("fraud_alerts").insert({
        hostel_id,
        risk_score: assessment.risk_score,
        flags: assessment.flags,
        status: "pending",
      });
    }

    return new Response(JSON.stringify(assessment), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fraud-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
