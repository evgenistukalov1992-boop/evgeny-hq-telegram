const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "Evgeny HQ Telegram" });
  }
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body?.message;
  if (!message?.chat?.id) return res.status(200).json({ ok: true });

  const text = (message.text || "").trim();
  const cmd = text.split(/\s+/)[0].toLowerCase();
  const replies = {
    "/start": HELP,
    "/help": HELP,
    "/today": "Утренний штаб. Напиши обязательства и встречи на сегодня. Я помогу выделить ровно 3 результата дня.",
    "/plan": "Пришли список задач. Оставим ровно 3 результата и следующий конкретный шаг по каждому.",
    "/task": "Напиши задачу и срок. Например: /task Подготовить расчёт заморозки до пятницы.",
    "/remind": "Напиши, о чём и когда напомнить. Например: /remind Оплатить счёт сегодня в 15:00.",
    "/done": "Что именно выполнено? Зафиксируем результат и следующий шаг.",
    "/delegate": "Напиши задачу и предполагаемого исполнителя. Сформулирую поручение, срок и контрольную точку.",
    "/week": "Недельный штаб: АГРО, ТЕРРИТОРИЯ, деньги, блокеры, делегирование и 3 результата следующей недели."
  };

  const reply = replies[cmd] || `Принял: «${text}».

Telegram-контур штаба работает. Следующий этап — подключение ИИ и Google Calendar, чтобы выполнять такие команды автоматически.`;

  try {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
    await send(message.chat.id, reply);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false });
  }
}
