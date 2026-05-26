const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageUrl, expectedTexts } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'imageUrl مطلوب' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const texts: string[] = Array.isArray(expectedTexts)
      ? expectedTexts.filter((t) => typeof t === 'string' && t.trim().length > 0)
      : [];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instruction = `You are a strict pre-press QA inspector for offset printing.
Analyze the supplied design image and respond ONLY by calling the function "qa_report".

Tasks:
1) Text accuracy: For EACH expected text below, verify it appears in the image EXACTLY (character-for-character, including Arabic letters, spaces, digits, punctuation). Mark match=false on the slightest mismatch (missing letter, broken Arabic ligature, wrong digit, typo).
2) CMYK safety: Detect any color that is outside the safe CMYK offset gamut (neon/fluorescent, pure RGB-only greens/blues/magentas, electric cyan beyond C100, oversaturated screen colors). List offending color regions briefly.

Expected texts (verbatim):
${texts.length ? texts.map((t, i) => `${i + 1}. «${t}»`).join('\n') : '(none provided)'}

Be strict. If unsure, mark as failure.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'qa_report',
              description: 'Return QA results for text accuracy and CMYK compliance.',
              parameters: {
                type: 'object',
                properties: {
                  text_results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        expected: { type: 'string' },
                        found: { type: 'string' },
                        match: { type: 'boolean' },
                        note: { type: 'string' },
                      },
                      required: ['expected', 'match'],
                      additionalProperties: false,
                    },
                  },
                  cmyk_safe: { type: 'boolean' },
                  cmyk_issues: { type: 'array', items: { type: 'string' } },
                  overall_pass: { type: 'boolean' },
                  summary: { type: 'string' },
                },
                required: ['text_results', 'cmyk_safe', 'overall_pass', 'summary'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'qa_report' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تم تجاوز الحد المسموح، حاول بعد قليل' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'رصيد الذكاء الاصطناعي غير كافٍ' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'فشل التحقق من التصميم' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error('No tool call returned:', JSON.stringify(data).slice(0, 600));
      return new Response(JSON.stringify({ error: 'تعذّر تحليل الاستجابة' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let report: any;
    try { report = JSON.parse(argsStr); } catch {
      return new Response(JSON.stringify({ error: 'استجابة غير صالحة' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce strict: any text mismatch or unsafe CMYK = fail.
    const textsOk = !report.text_results?.length || report.text_results.every((r: any) => r.match === true);
    const cmykOk = report.cmyk_safe === true;
    const pass = textsOk && cmykOk;

    return new Response(
      JSON.stringify({ pass, report: { ...report, overall_pass: pass } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('ai-design-verify error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'خطأ غير متوقع' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});