module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    }

    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions:
          "You are Crazy Assistant. Answer directly. Do not ask unnecessary follow-up questions.",
        input: message
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI API error"
      });
    }

    const text =
      data.output_text ||
      (data.output || [])
        .flatMap(x => x.content || [])
        .map(x => x.text || "")
        .join("");

    return res.status(200).json({
      answer: text || "No answer returned."
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
