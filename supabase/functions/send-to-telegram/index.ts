import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')
    if (!TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is not configured')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { orderId, designFilePath } = await req.json()
    if (!orderId || !designFilePath) {
      return new Response(JSON.stringify({ error: 'orderId and designFilePath are required' }), { status: 400, headers: corsHeaders })
    }

    // Fetch order with template info
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, templates(name, price)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders })
    }

    const details = order.details || {}
    const quantity = details.quantity || 1000
    const templatePrice = order.templates?.price || 0
    const totalPrice = templatePrice * (quantity / 1000)

    // Build message
    const deliveryPhone = details.delivery_phone || details.phone || '—'
    const deliveryProvince = details.delivery_province || '—'
    const deliveryArea = details.delivery_area || '—'
    const deliveryLandmark = details.delivery_landmark || ''
    const templateName = order.templates?.name || 'طلب تصميم'

    const address = `${deliveryProvince} — ${deliveryArea}${deliveryLandmark ? ` — ${deliveryLandmark}` : ''}`

    const message = `🖨 *طلب جاهز للطباعة*

📋 *القالب:* ${templateName}
📦 *الكمية:* ${quantity}
💰 *السعر الكلي:* ${totalPrice.toLocaleString()} د.ع

📍 *عنوان الاستلام:*
${address}

📞 *رقم الاستلام:* ${deliveryPhone}

🔗 *رقم الطلب:* \`${orderId.slice(0, 8)}\``

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from('designs')
      .download(designFilePath)

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
    const ext = designFilePath.split('.').pop()?.toLowerCase() || ''
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)

    if (fileData && !dlError) {
      // Send as photo (for images) or document (for PDFs etc.) with caption containing all info
      const formData = new FormData()
      formData.append('chat_id', TELEGRAM_CHAT_ID)
      formData.append('caption', message)
      formData.append('parse_mode', 'Markdown')

      const fileName = `design-${orderId.slice(0, 8)}.${ext}`

      formData.append('document', new Blob([await fileData.arrayBuffer()], { type: fileData.type }), fileName)
      const res = await fetch(`${telegramUrl}/sendDocument`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) console.error('Telegram sendDocument failed:', data)
    } else {
      // Fallback: send text message only
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in send-to-telegram:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
