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

const HELP = `Личный штаб Евгения

/today — план дня
/plan — 3 главных результата
/task — новая задача
/remind — напоминание
/done — отметить выполненное
/delegate — подготовить делегирование
/week — недельный штаб
/help — помощь

Можно писать обычным текстом.`;

async function askHQ(text) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      instructions: `Ты — Личный штаб Евгения. Отвечай по-русски, коротко и практично.
Главные текущие направления: АГРО и ТЕРРИТОРИЯ.
Твоя роль: помогать превращать поток задач в решения, выделять максимум 3 главных результата дня, следующий конкретный шаг, что делегировать, перенести или не делать.
Не утверждай, что изменил календарь, отправил письмо, создал напоминание или выполнил внешнее действие, если у тебя нет соответствующего инструмента. В таком случае прямо скажи, что действие пока не подключено.
Для утреннего штаба помоги выбрать 3 результата. Для дневной сверки оцени прогресс и выбери один обязательный результат до вечера. Для вечернего штаба зафиксируй выполненное, причины срыва и предварительные 3 результата завтра.`,
      input: text,
      max_output_tokens: 700
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  const outputText =
    data.output_text ||
    (data.output || [])
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text" && part.text)
      .map(part => part.text)
      .join("\n")
      .trim();

  if (!outputText) {
    console.error("OpenAI returned no text", JSON.stringify(data).slice(0, 2000));
    throw new Error("OpenAI returned no output text");
  }
  return outputText;
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

    if (text === "/start" || text === "/help") {
      await send(message.chat.id, HELP);
    } else if (!OPENAI_API_KEY) {
      await send(message.chat.id, "ИИ-модуль пока не подключён: отсутствует OPENAI_API_KEY.");
    } else {
      const prompt = text.startsWith("/today") ? "Проведи утренний штаб. " + text :
        text.startsWith("/plan") ? "Помоги выбрать ровно 3 главных результата. " + text :
        text.startsWith("/delegate") ? "Помоги сформулировать делегирование: исполнитель, результат, срок и контрольная точка. " + text :
        text.startsWith("/week") ? "Проведи недельный штаб по направлениям АГРО и ТЕРРИТОРИЯ. " + text :
        text;
      const reply = await askHQ(prompt);
      await send(message.chat.id, reply.slice(0, 4000));
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    try { await send(message.chat.id, "Ошибка штаба. Проверьте подключение ИИ и повторите запрос."); } catch {}
    return res.status(200).json({ ok: false });
  }
}
