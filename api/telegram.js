// Deployment refresh: 2026-09-19 — reload corrected Composio ak_ key
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

async function send(chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!r.ok) throw new Error("Telegram sendMessage failed");
}

const HELP = `Личный штаб Евгения

/today — утренний штаб: Яндекс.Почта + план дня
/mail — непрочитанные письма Яндекс.Почты
/plan — 3 главных результата
/task — новая задача
/remind — напоминание
/done — отметить выполненное
/delegate — подготовить делегирование
/week — недельный штаб
/help — помощь

Можно писать обычным текстом.`;

function extractComposioResult(data) {
  if (Array.isArray(data?.data?.result)) return data.data.result;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  return data?.data?.result || data?.data || data?.result || data;
}

async function getYandexUnread() {
  if (!COMPOSIO_API_KEY) throw new Error("COMPOSIO_API_KEY missing");
  const r = await fetch("https://backend.composio.dev/api/v3/tools/execute/CUSTOM_YANDEX_MAIL_LIST_UNREAD", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": COMPOSIO_API_KEY },
    body: JSON.stringify({ version: "20260919_00", arguments: {} })
  });
  const data = await r.json();
  if (!r.ok || data?.successful === false || data?.error) {
    throw new Error(data?.error?.message || data?.error || `Yandex Mail via Composio failed (${r.status})`);
  }
  return extractComposioResult(data);
}

function mailForPrompt(mail) {
  const raw = JSON.stringify(mail);
  return raw.length > 24000 ? raw.slice(0, 24000) + "…" : raw;
}

async function askHQ(text) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      instructions: `Ты — Личный штаб Евгения. Отвечай по-русски, коротко и практично.
Главные текущие направления: АГРО и ТЕРРИТОРИЯ.
Помогай превращать поток задач в решения, выделять максимум 3 главных результата дня, следующий конкретный шаг, что делегировать, перенести или не делать.
Если переданы данные Яндекс.Почты, это фактические непрочитанные письма, полученные read-only. Объединяй дубли. Рекламу и спам не включай в основные задачи. Важные письма разделяй: срочное / требует действия / информация; указывай отправителя, тему, срок только если он есть, и конкретное действие. Не выдумывай содержание и сроки.
Не утверждай, что изменил календарь, отправил письмо, создал напоминание или выполнил внешнее действие без соответствующего инструмента.
Для утреннего штаба выбери ровно 3 главных результата с приоритетом АГРО и ТЕРРИТОРИЯ, если актуальны; для каждого дай следующий конкретный шаг. Отдельно: решение лично Евгения; что делегировать; что сознательно не делать; короткий план дня.
Для дневной сверки оцени прогресс и выбери один обязательный результат до вечера. Для вечернего штаба зафиксируй выполненное, причины срыва и предварительные 3 результата завтра.`,
      input: text,
      max_output_tokens: 1100
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  const outputText = data.output_text || (data.output || []).flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && part.text).map(part => part.text).join("\n").trim();
  if (!outputText) throw new Error("OpenAI returned no output text");
  return outputText;
}

async function mailBrief() {
  const mail = await getYandexUnread();
  return askHQ(`Проанализируй непрочитанные письма Яндекс.Почты. Ничего в почте не изменяй. Данные:\n${mailForPrompt(mail)}`);
}

async function morningHQ(extra = "") {
  let mailContext;
  try {
    const mail = await getYandexUnread();
    mailContext = `Непрочитанные письма Яндекс.Почты (read-only):\n${mailForPrompt(mail)}`;
  } catch (e) {
    mailContext = `Яндекс.Почта недоступна в этом запуске. Ошибка: ${e.message}. Не выдумывай письма.`;
  }
  return askHQ(`Проведи утренний штаб. Сначала почта, затем ровно 3 результата дня. ${extra}\n\n${mailContext}`);
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({
    ok: true, service: "Evgeny HQ Telegram",
    ai: Boolean(OPENAI_API_KEY), yandexMail: Boolean(COMPOSIO_API_KEY)
  });
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body?.message;
  if (!message?.chat?.id) return res.status(200).json({ ok: true });
  const text = (message.text || "").trim();
  if (!text) return res.status(200).json({ ok: true });

  try {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
    let reply;
    if (text === "/start" || text === "/help") reply = HELP;
    else if (text === "/mail") {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
      reply = await mailBrief();
    } else if (text.startsWith("/today")) {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
      reply = await morningHQ(text.replace(/^\/today\s*/, ""));
    } else if (!OPENAI_API_KEY) reply = "ИИ-модуль пока не подключён: отсутствует OPENAI_API_KEY.";
    else {
      const prompt = text.startsWith("/plan") ? "Помоги выбрать ровно 3 главных результата. " + text :
        text.startsWith("/delegate") ? "Помоги сформулировать делегирование: исполнитель, результат, срок и контрольная точка. " + text :
        text.startsWith("/week") ? "Проведи недельный штаб по направлениям АГРО и ТЕРРИТОРИЯ. " + text : text;
      reply = await askHQ(prompt);
    }
    await send(message.chat.id, reply.slice(0, 4000));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    try { await send(message.chat.id, `Ошибка штаба: ${e.message}`.slice(0, 4000)); } catch {}
    return res.status(200).json({ ok: false });
  }
}