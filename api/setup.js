const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ok:false});
  if (!BOT_TOKEN) return res.status(500).json({ok:false,error:"TELEGRAM_BOT_TOKEN missing"});
  const webhook = "https://evgeny-hq-telegram.vercel.app/api/telegram";
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({url:webhook, allowed_updates:["message"]})
  });
  const data = await r.json();
  return res.status(r.ok ? 200 : 500).json({
    ok: Boolean(data.ok),
    description: data.description || null,
    webhook
  });
}
