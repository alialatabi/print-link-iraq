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
      ? `\n\nمقاس التصميم المطلوب: ${size.trim()} (التزم بهذه الأبعاد ونسبتها بدقة).`
      : '';

    const qualityDirectives = `

متطلبات إلزامية يجب الالتزام بها حرفياً:
1) دقة النصوص: اكتب جميع النصوص (العربية والإنجليزية والأرقام) بشكل صحيح 100% بدون أي حروف ناقصة أو زائدة أو مشوهة، وبدون أخطاء إملائية، مع وضوح كامل لكل حرف، والتزم بنفس النصوص المذكورة في وصف المستخدم حرفياً دون تعديل أو اختصار أو ترجمة.
2) الخطوط: استخدم خطوطاً عربية واضحة ومقروءة (مثل خطوط الديواني، الكوفي، الثلث، أو خطوط عصرية للنصوص)، وتأكد من اتصال الحروف العربية بشكل صحيح.
3) الألوان: استخدم فقط ألواناً متوافقة مع طباعة الأوفست بنظام CMYK (Cyan, Magenta, Yellow, Key/Black)، وتجنب تماماً ألوان RGB الفلورية أو النيون أو الألوان التي لا يمكن طباعتها بدقة (مثل الأخضر النيون، الوردي الفسفوري، الأزرق الكهربائي)، واعتمد ألواناً صلبة ومتناسقة قابلة للطباعة الاحترافية.
4) جودة الطباعة: التصميم يجب أن يكون جاهزاً للطباعة بدقة عالية (300 DPI)، مع هوامش أمان للنصوص، ووضوح كامل عند التكبير.
5) النسبة والأبعاد: حافظ على نسبة الأبعاد المطلوبة بدقة.${sizeLine}

قبل إنهاء التصميم: راجع جميع النصوص حرفاً حرفاً وتأكد من مطابقتها للوصف، وتأكد من أن كل الألوان المستخدمة قابلة للتحويل إلى CMYK بدون فقدان.`;

    const fullPrompt = `صمم لي ${serviceLabel || 'تصميم احترافي'} عالي الجودة بناءً على المواصفات التالية من المستخدم:\n\n"""${prompt}"""${qualityDirectives}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
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