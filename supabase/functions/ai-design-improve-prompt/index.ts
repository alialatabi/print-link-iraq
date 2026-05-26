const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { originalPrompt, failureReport, attempt } = await req.json();
    if (!originalPrompt || typeof originalPrompt !== 'string') {
      return new Response(JSON.stringify({ error: 'originalPrompt مطلوب' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const failed: string[] = [];
    const found: Record<string, string> = {};
    if (failureReport?.text_results?.length) {
      for (const r of failureReport.text_results) {
        if (r.match === false) {
          failed.push(r.expected);
          if (r.found) found[r.expected] = r.found;
        }
      }
    }
    const cmykIssues: string[] = Array.isArray(failureReport?.cmyk_issues) ? failureReport.cmyk_issues : [];

    const sys = `You rewrite Arabic/English design prompts for an image generator (Nano Banana) to fix specific QA failures from the previous attempt. Output ONLY the improved prompt text — no preamble, no explanation, no quotes around the whole thing. Keep the user's original intent, style, colors (unless CMYK-unsafe), and language. Strengthen the parts that failed.`;

    const userMsg = `Original prompt:
"""
${originalPrompt}
"""

Attempt #${attempt || 2} previous QA failures:
- Text mismatches (must appear EXACTLY, character-for-character):
${failed.length ? failed.map((t) => `  • «${t}»${found[t] ? ` (was rendered as «${found[t]}»)` : ''}`).join('\n') : '  (none)'}
- CMYK-unsafe colors detected: ${cmykIssues.length ? cmykIssues.join('، ') : '(none)'}

Rewrite the prompt so the next generation passes QA. Rules:
1) Re-state each failed text inside «...» and add a short directive: "render this Arabic/English text EXACTLY as written, no substitution, properly connected Arabic letters".
2) Replace any neon/fluorescent/RGB-only color hints with CMYK-safe equivalents (muted, print-ready). Explicitly add: "use only CMYK offset-safe colors, no neon or fluorescent".
3) Keep prompt concise and image-focused (≤ 1200 chars). Do NOT add storytelling.
4) Output the prompt in the same primary language as the original (Arabic if original is Arabic).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('improve-prompt gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تم تجاوز الحد المسموح' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'رصيد الذكاء الاصطناعي غير كافٍ' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'فشل تحسين البرومبت' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const improved = (data?.choices?.[0]?.message?.content || '').toString().trim();
    if (!improved) {
      return new Response(JSON.stringify({ error: 'لم يتم توليد برومبت محسّن' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ improvedPrompt: improved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-design-improve-prompt error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'خطأ غير متوقع' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});