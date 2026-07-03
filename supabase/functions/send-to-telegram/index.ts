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

type DesignFile = { buffer: ArrayBuffer; ext: string; label?: string }

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
    // designFiles     → MULTIPLE private-bucket paths, each with an optional label (two-face
    //                   products: the front + back faces, labelled الوجه الأمامي / الوجه الخلفي)
    // designFileUrls  → public URLs (e.g. reseller uploads in `order-attachments`) fetched over HTTP
    const { orderId, orderItemId, designFilePath, designFiles, designFileUrls } = await req.json()
    const fileUrls: string[] = Array.isArray(designFileUrls) ? designFileUrls.filter(Boolean) : []
    const privateFiles: Array<{ path: string; label?: string }> = Array.isArray(designFiles)
      ? designFiles.filter((f: unknown): f is { path: string; label?: string } =>
          !!f && typeof (f as { path?: unknown }).path === 'string' && !!(f as { path: string }).path)
      : []
    if (!orderId || (!designFilePath && privateFiles.length === 0 && fileUrls.length === 0)) {
      return new Response(JSON.stringify({ error: 'orderId and a design file (designFilePath, designFiles or designFileUrls) are required' }), { status: 400, headers: CORS_HEADERS_PLATFORM })
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

      // The specific item this file belongs to (by id, else inferred from the file path — for
      // two-face orders the first face path also carries the item id).
      const primaryPath = typeof designFilePath === 'string' ? designFilePath : (privateFiles[0]?.path || '')
      const current = items.find((i) => i.id === orderItemId)
        || items.find((i) => primaryPath.includes(i.id))
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
        if (!s) return ''
        const digits = s.replace(/^\+/, '')
        return digits.startsWith('964') ? `0${digits.slice(3)}` : s
      }

      // Delivery contact/address: the order's own details carry them ONLY after the customer
      // completed the delivery-address step. Direct approve→print (and any dispatch fired
      // before that step) has none — fall back to the customer's DEFAULT saved address, then
      // to the profile's address/account phone, and only then admit it's pending.
      let rawPhone: unknown = details.delivery_phone || details.phone
      let deliveryProvince: string = String(details.delivery_province || '')
      let deliveryArea: string = String(details.delivery_area || '')
      let deliveryLandmark: string = String(details.delivery_landmark || '')
      if (!rawPhone || !deliveryProvince) {
        const [{ data: savedRows }, { data: prof }] = await Promise.all([
          supabase
            .from('saved_addresses')
            .select('phone, province, area, landmark, is_default')
            .eq('user_id', order.customer_id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('profiles')
            .select('phone, province, area, landmark')
            .eq('user_id', order.customer_id)
            .maybeSingle(),
        ])
        const saved = ((savedRows || []) as Array<Record<string, unknown>>)[0]
        const profile = (prof || {}) as Record<string, unknown>
        rawPhone = rawPhone || saved?.phone || profile.phone
        deliveryProvince = deliveryProvince || String(saved?.province || profile.province || '')
        deliveryArea = deliveryArea || String(saved?.area || profile.area || '')
        deliveryLandmark = deliveryLandmark || String(saved?.landmark || profile.landmark || '')
      }
      const deliveryPhone = formatLocalPhone(rawPhone) || '—'
      const address = deliveryProvince
        ? `${deliveryProvince}${deliveryArea ? ` — ${deliveryArea}` : ''}${deliveryLandmark ? ` — ${deliveryLandmark}` : ''}`
        : 'لم يُحدَّد بعد — يصل مع موافقة الزبون'

      message = `🖨 *طلب جاهز للطباعة*

📋 *المنتج:* ${itemName}${sizeLabel}${isMulti ? `\n🧾 *العنصر:* ${idx} من ${items.length}` : ''}
📦 *الكمية:* ${Number(itemQty).toLocaleString()}

📍 *عنوان الاستلام:*
${address}

📞 *رقم الاستلام:* ${deliveryPhone === '—' ? '—' : `\`${deliveryPhone}\``}

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
    // Two-face products: download each labelled face from the private `designs` bucket (same trust
    // model as designFilePath — these are bucket paths, NOT URLs, so the SSRF allowlist is N/A).
    for (const f of privateFiles) {
      const { data: fileData, error: dlError } = await supabase.storage.from('designs').download(f.path)
      if (fileData && !dlError) {
        files.push({ buffer: await fileData.arrayBuffer(), ext: extFromPath(f.path), label: f.label })
      } else {
        console.error('Failed to download two-face design from storage:', f.path, dlError)
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

    // A filename slug for a face label so the files are tellable-apart even when saved to disk.
    const fileSlug = (label: string | undefined, i: number): string =>
      label === 'الوجه الأمامي' ? '-front' : label === 'الوجه الخلفي' ? '-back' : `-${i + 1}`

    // Multi-file sends (e.g. two-face front+back) go as ONE Telegram album (sendMediaGroup).
    // The full order caption sits on the LAST item — when exactly one item of a media group has
    // a caption, Telegram renders it below the whole album, i.e. the details appear under the
    // second (back) file, and both files live in a single message.
    const sendAsMediaGroup = async (groupFiles: DesignFile[], finalCaption: string) => {
      const formData = new FormData()
      formData.append('chat_id', TELEGRAM_CHAT_ID)
      const media = groupFiles.map((f, i) => ({
        type: 'document',
        media: `attach://file${i}`,
        ...(i === groupFiles.length - 1 ? { caption: finalCaption, parse_mode: 'Markdown' } : {}),
      }))
      formData.append('media', JSON.stringify(media))
      groupFiles.forEach((f, i) => {
        const mime = MIME_BY_EXT[f.ext] || 'application/octet-stream'
        formData.append(`file${i}`, new Blob([f.buffer], { type: mime }), `design-${shortId}${fileSlug(f.label, i)}.${f.ext}`)
      })
      const res = await fetch(`${telegramUrl}/sendMediaGroup`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) console.error('Telegram sendMediaGroup failed:', data)
      return res.ok
    }

    let sentAny = false

    // Album path: 2..10 files in one message, details caption below the last file. Face labels
    // are listed in the caption (in file order) and baked into the filenames (-front/-back).
    if (files.length >= 2 && files.length <= 10) {
      const labelsLine = files.some((f) => f.label)
        ? `\n\n📎 *الملفات بالترتيب:* ${files.map((f, i) => f.label || `ملف ${i + 1}`).join('، ')}`
        : ''
      sentAny = await sendAsMediaGroup(files, `${message}${labelsLine}`)
      if (sentAny) {
        // TIF previews can't join the album (converted after the fact) — send them separately.
        for (let i = 0; i < files.length; i++) {
          const { buffer, ext, label } = files[i]
          if (!['tif', 'tiff'].includes(ext)) continue
          try {
            const pngData = tifToPng(buffer)
            await sendDocument(pngData, `design-${shortId}${fileSlug(label, i)}.png`, 'image/png', `📎 نسخة PNG${label ? ` — ${label}` : ''} — طلب \`${shortId}\``)
          } catch (convErr) {
            console.error('TIF to PNG conversion failed:', convErr)
          }
        }
      }
    }

    // Single-file path + fallback if the album send failed.
    if (!sentAny && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const { buffer, ext, label } = files[i]
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
        const isTif = ['tif', 'tiff'].includes(ext)
        const suffix = files.length > 1 ? `-${i + 1}` : ''
        // The first file carries the full order caption (+ its label, e.g. الوجه الأمامي); each
        // subsequent file carries its own label so the print shop can tell the faces apart.
        const caption = i === 0
          ? (label ? `${message}\n\n🖼 *${label}*` : message)
          : (label ? `📎 *${label}* — طلب \`${shortId}\`` : `📎 ملف ${i + 1} — طلب \`${shortId}\``)
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
