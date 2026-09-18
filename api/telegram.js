const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function send(chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!r.ok) throw new Error("Telegram sendMessage failed");
}

const SYSTEM = `Ты — «Личный штаб Евгения», персональный ИИ-помощник руководителя.
Отвечай по-русски, кратко, конкретно и управленчески.
Главные текущие контуры: АГРО и ТЕРРИТОРИЯ.
Помогай превращать поток задач в результаты, выделять ровно 3 главных результата дня, следующий конкретный шаг, делегирование и перенос.
Не утверждай, что создал событие, напоминание, отправил письмо или изменил внешнюю систему, если соответствующий инструмент ещё не подключён. В таком случае прямо скажи, что подготовил действие, но интеграция ещё не подключена.
Для /today проведи короткий утренний штаб.
Для /plan помоги выбрать 3 результата.
Для /delegate сформулируй поручение: результат, исполнитель, срок, контрольная точка.
Для /week проведи недельный штаб по АГРО, ТЕРРИТОРИИ, деньгам, блокерам и делегированию.
Обычные сообщения понимай как естественный язык, а не требуй команд.`;

async function askAI(text) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      instructions: SYSTEM,
      input: text,
      max_output_tokens: 700
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) if (c.type === "output_text" && c.text) parts.push(c.text);
  }
  return parts.join("\n").trim() || "Не удалось сформировать ответ.";
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "Evgeny HQ Telegram", ai: Boolean(OPENAI_API_KEY) });
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body?.message;
  if (!message?.chat?.id) return res.status(200).json({ ok: true });
  const text = (message.text || "").trim();
  if (!text) return res.status(200).json({ ok: true });

  try {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
    const reply = await askAI(text);
    await send(message.chat.id, reply);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    try { await send(message.chat.id, "Штаб получил сообщение, но ИИ-контур сейчас недоступен. Проверьте настройки API."); } catch {}
    return res.status(500).json({ ok: false });
  }
}
