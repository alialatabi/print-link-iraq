import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// OpenAI config (confirm exact model ids / endpoints against OpenAI docs at deploy time).
const OPENAI_API = "https://api.openai.com/v1";
const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-5.5";
const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2";
// "low" keeps generation ~20-25s so the whole call stays under the edge-function request
// timeout (high quality is ~65s and times out). This is a draft the designer finalizes anyway.
const IMAGE_QUALITY = Deno.env.get("OPENAI_IMAGE_QUALITY") || "low";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") || "5");

// Real-cost config. OpenAI bills both models per token; rates are USD per 1M tokens and are
// overridable via secrets so they can be set to the exact gpt-5.5 / gpt-image-2 prices on your
// account. USD→IQD locks the conversion in at generation time. Defaults are estimates — adjust.
const USD_TO_IQD = Number(Deno.env.get("OPENAI_USD_TO_IQD") || "1480");
const COST_RATES = {
  textIn:  Number(Deno.env.get("OPENAI_TEXT_INPUT_USD_PER_M")   || "1.25"), // gpt-5.5 prompt tokens
  textOut: Number(Deno.env.get("OPENAI_TEXT_OUTPUT_USD_PER_M")  || "10"),   // gpt-5.5 output tokens
  imgIn:   Number(Deno.env.get("OPENAI_IMAGE_INPUT_USD_PER_M")  || "5"),    // gpt-image-2 input tokens
  imgOut:  Number(Deno.env.get("OPENAI_IMAGE_OUTPUT_USD_PER_M") || "40"),   // gpt-image-2 output (image) tokens
};

type Usage = Record<string, unknown> | null;

// Compute the real USD/IQD cost of one generation from the token usage reported by OpenAI.
// Field names cover both chat (prompt/completion_tokens) and image (input/output_tokens) shapes.
function computeCost(textUsage: Usage, imageUsage: Usage) {
  const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const tIn = n(textUsage?.prompt_tokens) || n(textUsage?.input_tokens);
  const tOut = n(textUsage?.completion_tokens) || n(textUsage?.output_tokens);
  const iIn = n(imageUsage?.input_tokens);
  const iOut = n(imageUsage?.output_tokens);
  const usd =
    (tIn * COST_RATES.textIn + tOut * COST_RATES.textOut +
     iIn * COST_RATES.imgIn + iOut * COST_RATES.imgOut) / 1_000_000;
  return {
    cost_usd: usd,
    cost_iqd: usd * USD_TO_IQD,
    usage: { text: textUsage, image: imageUsage },
  };
}

// Map a product type to a gpt-image-2 canvas size (closest supported aspect to the print piece).
function sizeForProduct(productType: string): string {
  switch (productType) {
    case "business_card":
    case "banner":
    case "letterhead":
      return "1536x1024"; // landscape
    case "flyer":
    case "menu":
    case "invitation":
    case "poster":
    case "roll_up":
      return "1024x1536"; // portrait
    case "receipt_design":
    case "doctor_rx":
      return "1024x1536"; // portrait (A5-style forms)
    case "sticker_rect":
    case "flex":
    case "card_single":
    case "card_double":
      return "1536x1024"; // landscape default
    case "stamp":
    case "sticker_circle":
      return "1024x1024"; // square
    default:
      return "1024x1024"; // square (logo / social / generic)
  }
}

// Stage 1: GPT-5.5 rewrites the customer's raw brief into a tight, CMYK-print-safe image prompt.
async function rewritePrompt(apiKey: string, brief: string, productLabel: string, sizeLabel: string, directives: string): Promise<{ prompt: string; usage: Usage }> {
  const system =
    "You are a pre-press print-design prompt engineer. Convert the customer's brief (often Arabic) " +
    "into ONE concise English image-generation prompt for a print-ready design. Output ONLY the prompt text — " +
    "no preamble, no quotes, no explanation. Rules: flat 2D vector-style, front-facing (no 3D/mockup/perspective/" +
    "shadows/reflections); 300 DPI; use ONLY CMYK offset-safe colors (no neon, fluorescent, or RGB-only colors); " +
    "high contrast; clear safe margins and bleed. Render every piece of the customer's text EXACTLY as written, " +
    "fully legible, with Arabic letters properly connected. Keep it under 1200 characters. Preserve the customer's " +
    "intent, language of the on-design text, colors (unless CMYK-unsafe), and style. " +
    "CRITICAL: avoid very dark or predominantly black designs — never flood large areas with black or very dark colors; " +
    "favor light, clean backgrounds with strong contrast. " +
    "Make ALL text large, correctly spelled, sharply legible, and the visual priority of the design. " +
    "Prioritize text over imagery: keep illustrations, photos, and decorative shapes minimal and secondary to the text.";
  let userMsg =
    `Product: ${productLabel}. Target size: ${sizeLabel}.\n` +
    `Customer brief (render any literal text verbatim):\n"""\n${brief}\n"""`;
  if (directives) {
    userMsg += `\nDesign directives: ${directives}`;
  }

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("rewritePrompt error:", res.status, errText);
    // Non-fatal: fall back to the raw brief so generation can still proceed.
    return { prompt: "", usage: null };
  }
  const data = await res.json();
  return {
    prompt: (data?.choices?.[0]?.message?.content || "").toString().trim(),
    usage: (data?.usage as Usage) ?? null,
  };
}

// Stage 2: gpt-image-2 generates the design. Returns a data URL (b64) or a hosted URL + token usage.
async function generateImage(apiKey: string, prompt: string, size: string): Promise<{ image: string | null; usage: Usage }> {
  const res = await fetch(`${OPENAI_API}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size, quality: IMAGE_QUALITY, n: 1 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("generateImage error:", res.status, errText);
    throw new Response(
      JSON.stringify({ error: res.status === 429 ? "تم تجاوز الحد المسموح، حاول بعد قليل" : "فشل توليد التصميم" }),
      { status: res.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  const usage = (data?.usage as Usage) ?? null;
  const item = data?.data?.[0];
  if (item?.b64_json) return { image: `data:image/png;base64,${item.b64_json}`, usage };
  if (item?.url) return { image: item.url as string, usage };
  console.error("No image in response:", JSON.stringify(data).slice(0, 400));
  return { image: null, usage };
}

// Decode a `data:image/...;base64,...` URL into raw bytes.
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Stage 2 (with references): gpt-image-2 EDITS — generates the design while incorporating the
// customer's uploaded reference/logo image(s). Multipart form-data; mirrors generateImage's output.
async function generateImageEdit(apiKey: string, prompt: string, size: string, images: Uint8Array[]): Promise<{ image: string | null; usage: Usage }> {
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", IMAGE_QUALITY);
  form.append("n", "1");
  images.forEach((bytes, i) => form.append("image[]", new Blob([bytes], { type: "image/png" }), `reference-${i}.png`));

  // No explicit Content-Type — fetch sets the multipart boundary.
  const res = await fetch(`${OPENAI_API}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("generateImageEdit error:", res.status, errText);
    throw new Response(
      JSON.stringify({ error: res.status === 429 ? "تم تجاوز الحد المسموح، حاول بعد قليل" : "فشل توليد التصميم بالصور المرجعية" }),
      { status: res.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  const usage = (data?.usage as Usage) ?? null;
  const item = data?.data?.[0];
  if (item?.b64_json) return { image: `data:image/png;base64,${item.b64_json}`, usage };
  if (item?.url) return { image: item.url as string, usage };
  console.error("No image in edit response:", JSON.stringify(data).slice(0, 400));
  return { image: null, usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "غير مصرح" }, 401);

    // Verify the requesting user. In an edge function there is no stored session, so getUser()
    // with no argument returns "Auth session missing!" — the JWT MUST be passed explicitly.
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(jwt);
    if (userError || !user) return json({ error: "غير مصرح" }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return json({ error: "خدمة الذكاء الاصطناعي غير مهيأة" }, 500);
    }

    const { brief, productType, productLabel, sizeLabel, canvasSize, directives, referenceImages } = await req.json();
    if (!brief || typeof brief !== "string" || brief.trim().length < 5) {
      return json({ error: "يرجى كتابة وصف أوضح للتصميم" }, 400);
    }

    // Optional reference/logo images (base64 data URLs). Capped at 3 to bound payload + cost.
    const refImages: string[] = Array.isArray(referenceImages)
      ? referenceImages.filter((s: unknown) => typeof s === "string" && (s as string).startsWith("data:image")).slice(0, 3)
      : [];

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Rate limit: count this user's generations since the start of today (UTC).
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await supabaseAdmin
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());
    if (countError) {
      console.error("rate-limit count error:", countError.message);
    }
    const used = count || 0;
    if (used >= DAILY_LIMIT) {
      return json({ error: `لقد استنفدت عدد التصاميم لهذا اليوم (${DAILY_LIMIT}). حاول غداً.` }, 429);
    }

    const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536"]);
    const size = (typeof canvasSize === "string" && allowedSizes.has(canvasSize))
      ? canvasSize
      : sizeForProduct(typeof productType === "string" ? productType : "");
    const directiveText = typeof directives === "string" ? directives.trim() : "";
    const label = (typeof productLabel === "string" && productLabel.trim()) || "تصميم";
    const sizeText = (typeof sizeLabel === "string" && sizeLabel.trim()) || size;

    // Stage 1 (best-effort) → Stage 2.
    const { prompt: rewritten, usage: textUsage } = await rewritePrompt(apiKey, brief.trim(), label, sizeText, directiveText);
    const effectivePrompt = rewritten ||
      `Professional print-ready ${label}, flat 2D vector style, front-facing (no 3D/mockup/shadows), 300 DPI, ` +
      `CMYK offset-safe colors only (no neon/fluorescent), clear margins. Render all text exactly as written, ` +
      `Arabic letters properly connected. Size ${sizeText}.${directiveText ? " Design directives: " + directiveText + "." : ""} Brief:\n${brief.trim()}`;

    // With reference/logo images → use the edits endpoint so they're composited into the design.
    const { image: imageDataUrl, usage: imageUsage } = refImages.length > 0
      ? await generateImageEdit(
          apiKey,
          effectivePrompt +
            " Incorporate the provided reference image(s)/logo into the design faithfully and prominently — preserve their exact colors, shapes and any text, place them cleanly within the layout, and keep them crisp.",
          size,
          refImages.map(dataUrlToBytes),
        )
      : await generateImage(apiKey, effectivePrompt, size);
    if (!imageDataUrl) return json({ error: "لم يتم توليد صورة" }, 502);

    // Real OpenAI cost for this generation, from the reported token usage.
    const { cost_usd, cost_iqd, usage } = computeCost(textUsage, imageUsage);

    // Log the generation (counts toward the daily limit; image is uploaded only on accept).
    const { data: gen } = await supabaseAdmin
      .from("ai_generations")
      .insert({
        user_id: user.id,
        brief: brief.trim(),
        product_type: typeof productType === "string" ? productType : null,
        size,
        rewritten_prompt: effectivePrompt,
        model: IMAGE_MODEL,
        cost_usd,
        cost_iqd,
        usage,
      })
      .select("id")
      .single();

    return json({
      imageDataUrl,
      rewrittenPrompt: effectivePrompt,
      generationId: gen?.id || null,
      remaining: Math.max(0, DAILY_LIMIT - used - 1),
    });
  } catch (e) {
    // generateImage throws a Response on upstream image errors — pass it through.
    if (e instanceof Response) return e;
    console.error("ai-design-generate error:", e);
    return json({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }, 500);
  }
});
