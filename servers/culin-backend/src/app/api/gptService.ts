import OpenAI from "openai";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

export const getGPTResponse = async (prompt: string, model: string) => {
  try {
    const gptResponse = await getOpenAI().chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
    });

    return gptResponse.choices[0]?.message?.content || "No response from AI.";
  } catch (error) {
    console.error("Error with GPT API:", error);
    return "Error fetching GPT response.";
  }
};
