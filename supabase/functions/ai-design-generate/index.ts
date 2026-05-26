const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, serviceLabel, size } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'يرجى كتابة وصف للتصميم' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sizeLine = size && typeof size === 'string' && size.trim()
      ? ` Exact dimensions: ${size.trim()} (keep aspect ratio precisely).`
      : '';

    // Keep prompt short and image-focused. Long instruction blocks make Nano Banana return text instead of an image.
    const fullPrompt = `Professional print-ready ${serviceLabel || 'design'}, 300 DPI, CMYK offset-printing safe colors only (no neon/fluorescent/RGB-only colors).${sizeLine} All text must be spelled exactly as given, fully legible, Arabic letters properly connected. User brief (render text verbatim):\n${prompt}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [{ role: 'user', content: fullPrompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تم تجاوز الحد المسموح، حاول بعد قليل' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'رصيد الذكاء الاصطناعي غير كافٍ' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'فشل توليد التصميم' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: 'لم يتم توليد صورة' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-design-generate error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'خطأ غير متوقع' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});