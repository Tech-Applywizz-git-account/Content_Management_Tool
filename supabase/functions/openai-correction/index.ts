/// <reference lib="dom" />
/// <reference lib="deno.ns" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface Issue {
  type: "spelling" | "grammar";
  incorrect: string;
  suggestion: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Narrow focus to just spelling and grammar as requested
    const systemMessage = `You are a professional proofreader. 
Your ONLY task is to identify:
1. Spelling errors
2. Clear grammar mistakes

RULES:
- Do NOT suggest stylistic enhancements or rewriters.
- Do NOT change the tone.
- If the text is correct, return an empty array.
- Return ONLY a JSON object: {"issues": [{"type": "spelling"|"grammar", "incorrect": "original text", "suggestion": "correction"}]}`;

    const userMessage = `Correct the spelling and grammar in this text:
"${text}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content || '{"issues": []}');

    // Return only spelling/grammar
    const filteredIssues = (parsed.issues || []).filter((i: any) =>
      i.type === 'spelling' || i.type === 'grammar'
    );

    return new Response(JSON.stringify({ issues: filteredIssues }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Correction error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});