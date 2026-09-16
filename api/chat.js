module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured in Vercel."
      });
    }

    if (!model) {
      return res.status(500).json({
        error: "OPENAI_MODEL is not configured in Vercel."
      });
    }

    const {
      message,
      history = [],
      mode = "assistant",
      persona = "normal",
      useWebSearch = false,
      file = null
    } = req.body || {};

    if (!message && !file) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    /* =========================
       PERSONA
    ========================= */

    const personas = {
      normal:
        "You are Crazy Assistant, a helpful general AI assistant. Answer clearly and directly.",

      friendly:
        "You are Crazy Assistant. Be friendly, warm, simple and easy to understand.",

      professional:
        "You are Crazy Assistant. Give professional, accurate and well-structured answers.",

      teacher:
        "You are Crazy Assistant acting as a teacher. Explain difficult topics step by step in simple language.",

      coder:
        "You are Crazy Assistant acting as an expert programming assistant. Provide correct, practical code and explain it clearly."
    };

    /* =========================
       MODE
    ========================= */

    const modes = {
      assistant:
        "General purpose assistant.",

      coding:
        "Focus on programming, debugging, websites, apps and software development.",

      study:
        "Focus on education, studying, explanations, examples and revision.",

      creative:
        "Focus on stories, scripts, ideas, writing and creative work.",

      gaming:
        "Focus on gaming, gameplay, game development and gaming content."
    };

    const instructions = `
${personas[persona] || personas.normal}

Current mode:
${modes[mode] || modes.assistant}

Important rules:
- Answer the user's actual question.
- Do not unnecessarily ask follow-up questions.
- Use simple language when possible.
- If the user asks for code, provide usable code.
- Do not claim that you performed an action that you did not perform.
- If information is uncertain, say so.
- Respect the conversation context.
`;

    /* =========================
       CONVERSATION HISTORY
    ========================= */

    const safeHistory = Array.isArray(history)
      ? history.slice(-12)
      : [];

    const input = [];

    for (const item of safeHistory) {
      if (!item || !item.role || !item.content) {
        continue;
      }

      const role =
        item.role === "assistant"
          ? "assistant"
          : "user";

      input.push({
        role,
        content: [
          {
            type: "input_text",
            text: String(item.content)
          }
        ]
      });
    }

    /* =========================
       CURRENT USER MESSAGE
    ========================= */

    const currentContent = [];

    if (message) {
      currentContent.push({
        type: "input_text",
        text: String(message)
      });
    }

    /* =========================
       IMAGE / FILE
    ========================= */

    if (file && file.data) {
      const dataUrl = String(file.data);

      if (dataUrl.startsWith("data:image/")) {
        currentContent.push({
          type: "input_image",
          image_url: dataUrl
        });
      } else if (dataUrl.startsWith("data:")) {
        const base64Data =
          dataUrl.split(",")[1];

        if (base64Data) {
          currentContent.push({
            type: "input_file",
            filename:
              file.name || "uploaded-file",
            file_data: base64Data
          });
        }
      }
    }

    input.push({
      role: "user",
      content: currentContent
    });

    /* =========================
       OPENAI REQUEST
    ========================= */

    const body = {
      model,
      instructions,
      input
    };

    /*
      Web search is optional.

      Enable it only when your selected
      OpenAI API model/account supports
      the web search tool.
    */

    if (useWebSearch) {
      body.tools = [
        {
          type: "web_search_preview"
        }
      ];
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    /* =========================
       API ERROR
    ========================= */

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI API request failed."
      });
    }

    /* =========================
       GET ANSWER
    ========================= */

    let answer =
      data.output_text || "";

    if (!answer && Array.isArray(data.output)) {
      answer = data.output
        .flatMap(item =>
          Array.isArray(item.content)
            ? item.content
            : []
        )
        .map(item =>
          item.text || ""
        )
        .join("");
    }

    if (!answer) {
      answer =
        "I received a response, but no text answer was returned.";
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {

    console.error(
      "Server error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Internal server error."
    });
  }
};
