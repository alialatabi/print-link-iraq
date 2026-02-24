import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const baseUrl = "https://matbaty.lovable.app";
  const now = new Date().toISOString().split('T')[0];

  // Static pages
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/services`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${baseUrl}/auth`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${baseUrl}/upload-design`, changefreq: 'monthly', priority: '0.7' },
  ];

  // Parent services (sub-services pages)
  const { data: parentServices } = await supabase
    .from('services')
    .select('id')
    .is('parent_id', null);

  if (parentServices) {
    for (const s of parentServices) {
      urls.push({ loc: `${baseUrl}/sub-services/${s.id}`, changefreq: 'weekly', priority: '0.8' });
    }
  }

  // Sub-services (template listing pages)
  const { data: subServices } = await supabase
    .from('services')
    .select('id')
    .not('parent_id', 'is', null);

  if (subServices) {
    for (const s of subServices) {
      urls.push({ loc: `${baseUrl}/templates/${s.id}`, changefreq: 'weekly', priority: '0.7' });
    }
  }

  // Templates (detail pages)
  const { data: templates } = await supabase
    .from('templates')
    .select('id');

  if (templates) {
    for (const t of templates) {
      urls.push({ loc: `${baseUrl}/template/${t.id}`, changefreq: 'weekly', priority: '0.6' });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});
