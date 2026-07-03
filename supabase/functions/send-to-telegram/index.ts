import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import UTIF from 'https://esm.sh/utif2@4.1.0'
import UPNG from 'https://esm.sh/upng-js@2.1.0'
import { CORS_HEADERS_PLATFORM } from '../_shared/helpers.ts'

// Flat delivery fee (IQD) added to every customer order total.
const DELIVERY_FEE = 5000

function tifToPng(tifBuffer: ArrayBuffer): Uint8Array {
  const ifds = UTIF.decode(tifBuffer)
  UTIF.decodeImage(tifBuffer, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const width = ifds[0].width
  const height = ifds[0].height
  const png = UPNG.encode([rgba.buffer], width, height, 0)
  return new Uint8Array(png)
}

const MIME_BY_EXT: Record<string, string> = {
  tif: 'image/tiff',
  tiff: 'image/tiff',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

// Extract a lowercase file extension from a storage path or a public URL (ignoring any query string).
function extFromPath(path: string): string {
  const clean = path.split('?')[0].split('#')[0]
  return clean.split('.').pop()?.toLowerCase() || ''
}

type DesignFile = { buffer: ArrayBuffer; ext: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS_PLATFORM })
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')
    if (!TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is not configured')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth: require a VALID JWT (not just a "Bearer " prefix) belonging to a staff
    // member — this endpoint pushes orders to print and fetches design files server-side.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS_PLATFORM, 'Content-Type': 'application/json' } })
    }
    // send-to-telegram's admin client omits auth options — preserved as-is.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS_PLATFORM, 'Content-Type': 'application/json' } })
    }
    const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    if (!(roleRows || []).some((r: { role: string }) => ['admin', 'designer', 'reseller'].includes(r.role))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...CORS_HEADERS_PLATFORM, 'Content-Type': 'application/json' } })
    }

    // SSRF guard: design URLs may ONLY point at this project's own Supabase storage host.
    const supabaseHost = new URL(SUPABASE_URL).hostname
    const isAllowedDesignUrl = (u: string): boolean => {
      try { const p = new URL(u); return p.protocol === 'https:' && p.hostname === supabaseHost }
      catch { return false }
    }

    // designFilePath  → a single path inside the private `designs` bucket (customer/template flow)
    // designFileUrls  → public URLs (e.g. reseller uploads in `order-attachments`) fetched over HTTP
    const { orderId, orderItemId, designFilePath, designFileUrls } = await req.json()
    const fileUrls: string[] = Array.isArray(designFileUrls) ? designFileUrls.filter(Boolean) : []
    if (!orderId || (!designFilePath && fileUrls.length === 0)) {
      return new Response(JSON.stringify({ error: 'orderId and a design file (designFilePath or designFileUrls) are required' }), { status: 400, headers: CORS_HEADERS_PLATFORM })
    }

    // Fetch order with template info
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, templates(name, price)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: CORS_HEADERS_PLATFORM })
    }

    const details = order.details || {}
    const isReseller = details.order_type === 'reseller'

    // Build the caption — reseller print jobs and customer orders carry different fields.
    let message: string
    if (isReseller) {
      const quantity = details.quantity || 1000
      const serviceLabel = details.service_label || 'طلب طباعة'
      const cellophane = details.cellophane === 'glossy' ? 'لامع' : details.cellophane === 'matte' ? 'مطفي' : null
      const total = details.pricing?.total ?? 0
      message = `🖨 *طلب مطبعة جاهز للطباعة*

📋 *المنتج:* ${serviceLabel}
📦 *الكمية:* ${Number(quantity).toLocaleString()}
${cellophane ? `✨ *السلوفان:* ${cellophane}\n` : ''}💰 *الكلفة:* ${Number(total).toLocaleString()} د.ع

🔗 *رقم الطلب:* \`${orderId.slice(0, 8)}\``
    } else {
      // Customer order: the total is the sum of ALL items (+ flat delivery fee). It is sent with
      // every file so each item in a multi-item order carries the full delivery + total info.
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, templates(name, service_type)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
      const items = (itemsData || []) as Array<Record<string, unknown>>

      // Look up service prices for non-AI items (service price is per `min_quantity`, default 1000).
      const svcTypes = [...new Set(items.map((i) => i.templates?.service_type).filter(Boolean))]
      const svcMap = new Map<string, { price: number; min_quantity: number }>()
      if (svcTypes.length > 0) {
        const { data: svcs } = await supabase.from('services').select('id, price, min_quantity').in('id', svcTypes)
        for (const s of (svcs || []) as Array<Record<string, unknown>>) {
          svcMap.set(s.id, { price: Number(s.price) || 0, min_quantity: Number(s.min_quantity) || 1000 })
        }
      }
      const priceOfItem = (it: Record<string, unknown>): number => {
        const d = it.details || {}
        // Prefer the immutable pricing snapshot written at checkout — it's the authoritative
        // amount the customer saw. Recompute from the live catalog only for legacy items.
        const snap = Number(d.pricing?.line_total)
        if (Number.isFinite(snap) && snap > 0) return snap
        const qty = Number(d.quantity) || 1
        if (d.is_ai_design) return (Number(d.unit_price) || 0) * qty
        const svc = svcMap.get(it.templates?.service_type)
        if (!svc) return 0
        return Math.ceil(svc.price * (qty / (svc.min_quantity || 1000)))
      }
      let itemsTotal = items.reduce((sum, it) => sum + priceOfItem(it), 0)

      // The specific item this file belongs to (by id, else inferred from the file path).
      const current = items.find((i) => i.id === orderItemId)
        || items.find((i) => typeof designFilePath === 'string' && designFilePath.includes(i.id))
        || items[0]
      const cd = current?.details || {}
      let itemName: string = cd.service_label || current?.templates?.name || ''
      let itemQty = Number(cd.quantity) || 0
      let sizeLabelRaw: unknown = cd.size_label

      // Item-less orders (vault reorder / ready-design): there are NO order_items rows — the
      // product, quantity and pricing snapshot all live on the ORDER's own details JSON.
      // Without this fallback the caption showed "تصميم / الكمية: 1" and a total equal to the
      // delivery fee alone.
      if (items.length === 0) {
        itemsTotal = Number(details.pricing?.line_total) || 0
        itemQty = Number(details.quantity) || 0
        sizeLabelRaw = details.size_label
        itemName = details.service_label || ''
        if (!itemName && details.service_type) {
          // The service label lives in the catalog (services.id values like 'vip_card' → كارت وجهين).
          const { data: svc } = await supabase
            .from('services').select('label').eq('id', String(details.service_type)).maybeSingle()
          itemName = (svc as { label?: string } | null)?.label || ''
        }
        if (!itemName) itemName = order.templates?.name || ''
      }
      if (!itemName) itemName = 'تصميم'
      if (!itemQty) itemQty = 1

      const grandTotal = itemsTotal + DELIVERY_FEE
      const sizeLabel = sizeLabelRaw ? ` — ${sizeLabelRaw}` : ''
      const idx = current ? items.findIndex((i) => i.id === current.id) + 1 : 0
      const isMulti = items.length > 1

      // Show the pickup phone in the local Iraqi format the print shop dials
      // (9647712253264 → 07712253264); numbers already starting with 0 pass through.
      const formatLocalPhone = (p: unknown): string => {
        const s = String(p ?? '').trim()
        if (!s) return '—'
        const digits = s.replace(/^\+/, '')
        return digits.startsWith('964') ? `0${digits.slice(3)}` : s
      }
      const deliveryPhone = formatLocalPhone(details.delivery_phone || details.phone)
      const deliveryProvince = details.delivery_province || '—'
      const deliveryArea = details.delivery_area || '—'
      const deliveryLandmark = details.delivery_landmark || ''
      const address = `${deliveryProvince} — ${deliveryArea}${deliveryLandmark ? ` — ${deliveryLandmark}` : ''}`

      message = `🖨 *طلب جاهز للطباعة*

📋 *المنتج:* ${itemName}${sizeLabel}${isMulti ? `\n🧾 *العنصر:* ${idx} من ${items.length}` : ''}
📦 *الكمية:* ${Number(itemQty).toLocaleString()}

📍 *عنوان الاستلام:*
${address}

📞 *رقم الاستلام:* ${deliveryPhone}

💰 *المجموع الكلي:* ${grandTotal.toLocaleString()} د.ع _(شامل التوصيل ${DELIVERY_FEE.toLocaleString()} د.ع)_

🔗 *رقم الطلب:* \`${orderId.slice(0, 8)}\``
    }

    // Collect the design file(s) to send.
    const files: DesignFile[] = []
    if (designFilePath) {
      const { data: fileData, error: dlError } = await supabase.storage.from('designs').download(designFilePath)
      if (fileData && !dlError) {
        files.push({ buffer: await fileData.arrayBuffer(), ext: extFromPath(designFilePath) })
      } else {
        console.error('Failed to download design from storage:', dlError)
      }
    }
    for (const url of fileUrls) {
      if (!isAllowedDesignUrl(url)) { console.error('Blocked non-allowlisted design URL:', url); continue }
      try {
        const res = await fetch(url)
        if (!res.ok) { console.error(`Failed to fetch design URL [${res.status}]:`, url); continue }
        files.push({ buffer: await res.arrayBuffer(), ext: extFromPath(url) })
      } catch (fetchErr) {
        console.error('Error fetching design URL:', url, fetchErr)
      }
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
    const shortId = orderId.slice(0, 8)

    const sendDocument = async (buffer: ArrayBuffer | Uint8Array, fileName: string, mime: string, caption: string) => {
      const formData = new FormData()
      formData.append('chat_id', TELEGRAM_CHAT_ID)
      formData.append('caption', caption)
      formData.append('parse_mode', 'Markdown')
      formData.append('document', new Blob([buffer], { type: mime }), fileName)
      const res = await fetch(`${telegramUrl}/sendDocument`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) console.error('Telegram sendDocument failed:', data)
      return res.ok
    }

    let sentAny = false
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const { buffer, ext } = files[i]
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
        const isTif = ['tif', 'tiff'].includes(ext)
        const suffix = files.length > 1 ? `-${i + 1}` : ''
        const caption = i === 0 ? message : `📎 ملف ${i + 1} — طلب \`${shortId}\``
        const ok = await sendDocument(buffer, `design-${shortId}${suffix}.${ext}`, mime, caption)
        sentAny = sentAny || ok

        // For TIF files, also send a PNG preview so it can be viewed inline.
        if (isTif) {
          try {
            const pngData = tifToPng(buffer)
            await sendDocument(pngData, `design-${shortId}${suffix}.png`, 'image/png', `📎 نسخة PNG — طلب \`${shortId}\``)
          } catch (convErr) {
            console.error('TIF to PNG conversion failed:', convErr)
            await fetch(`${telegramUrl}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: `⚠️ تعذر تحويل ملف TIF إلى PNG للطلب \`${shortId}\``,
                parse_mode: 'Markdown',
              }),
            })
          }
        }
      }
    }

    // Fallback: if no file could be sent, at least deliver the order details as text.
    if (!sentAny) {
      const msgRes = await fetch(`${telegramUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
      })
      const msgData = await msgRes.json()
      if (!msgRes.ok) throw new Error(`Telegram sendMessage failed [${msgRes.status}]: ${JSON.stringify(msgData)}`)
    }

    // Update order status to print_ready
    await supabase
      .from('orders')
      .update({ status: 'print_ready' })
      .eq('id', orderId)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS_HEADERS_PLATFORM, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in send-to-telegram:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS_PLATFORM, 'Content-Type': 'application/json' },
    })
  }
})
