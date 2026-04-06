import { GoogleGenAI, Type, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { NewsItem } from "../types.js";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Check multiple possible locations for the API key with safety checks
    let apiKey = "";
    try {
      apiKey = process.env.GEMINI_API_KEY || "";
    } catch (e) {
      // process.env might not be defined
    }
    
    if (!apiKey) {
      const meta = import.meta as any;
      apiKey = (meta.env && meta.env.VITE_GEMINI_API_KEY) ||
               (meta.env && meta.env.GEMINI_API_KEY) || "";
    }
                   
    if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not set. Please check your environment variables in the Secrets panel.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function callGeminiWithRetry(
  params: GenerateContentParameters,
  maxRetries = 5,
  initialDelay = 2000
): Promise<GenerateContentResponse> {
  let lastError: any;
  const ai = getAI();
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      
      // Check for rate limit error (429) in various formats
      let errorStr = "";
      try {
        errorStr = JSON.stringify(error).toLowerCase();
      } catch (e) {
        errorStr = String(error).toLowerCase();
      }
      const isRateLimit = error?.status === 'RESOURCE_EXHAUSTED' || 
                         error?.code === 429 ||
                         errorStr.includes('429') ||
                         errorStr.includes('quota') ||
                         errorStr.includes('resource_exhausted');

      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Re-throw other errors
    }
  }
  throw lastError;
}

export async function analyzeNews(newsItems: NewsItem[]): Promise<NewsItem[]> {
  if (newsItems.length === 0) return [];

  // Reduce AI usage by only analyzing the top 3 most recent/relevant items
  const itemsToAnalyze = newsItems.slice(0, 3);

  const prompt = `
    Analyze the following crypto news items. 
    For each item:
    1. Determine if it is related to political or economic macro events (e.g., central bank policies, wars, sanctions, government regulations).
    2. Determine the sentiment (positive, negative, or neutral) for the crypto market.
    3. Assign an impact score from -100 (extremely negative) to 100 (extremely positive).

    News Items:
    ${itemsToAnalyze.map((item, i) => `${i + 1}. ${item.title}`).join('\n')}

    Return the results as a JSON array of objects with the following structure:
    {
      "index": number,
      "is_political": boolean,
      "sentiment": "positive" | "negative" | "neutral",
      "impact_score": number
    }
  `;

  try {
    const response = await callGeminiWithRetry({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.NUMBER },
              is_political: { type: Type.BOOLEAN },
              sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
              impact_score: { type: Type.NUMBER }
            },
            required: ["index", "is_political", "sentiment", "impact_score"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI model");
    }

    const results = JSON.parse(response.text);

    return newsItems.map((item, i) => {
      // Only the first 3 items were analyzed
      if (i >= 3) return item;
      
      const result = results.find((r: any) => r.index === i + 1);
      if (result) {
        return {
          ...item,
          is_political: result.is_political,
          sentiment: result.sentiment,
          impact_score: result.impact_score
        };
      }
      return item;
    });
  } catch (error) {
    console.error("Error analyzing news with Gemini:", error instanceof Error ? error.message : String(error));
    return newsItems;
  }
}

export function calculateNewsScore(analyzedNews: NewsItem[]): number {
  const politicalNews = analyzedNews.filter(n => n.is_political);
  if (politicalNews.length === 0) return 0;

  const totalScore = politicalNews.reduce((acc, n) => acc + (n.impact_score || 0), 0);
  return totalScore / politicalNews.length;
}

export async function getChatResponse(
  message: string, 
  context: { 
    symbol: string; 
    price: number; 
    indicators: any; 
    news: NewsItem[];
    technicalScore: number;
    newsScore: number;
    whaleActivity?: string;
    fearGreedIndex?: number;
  }
): Promise<string> {
  let indicatorsStr = "";
  try {
    indicatorsStr = JSON.stringify(context.indicators);
  } catch (e) {
    indicatorsStr = "[Complex Indicators Object]";
  }

  const prompt = `
    You are an expert Crypto Trading Advisor using the "Crypto Fusion Strategy v3".
    
    Current Market Context for ${context.symbol}:
    - Price: $${context.price}
    - Technical Score: ${context.technicalScore}/100
    - News Sentiment Score: ${context.newsScore}%
    - Indicators: ${indicatorsStr}
    - Recent News: ${context.news.slice(0, 5).map(n => n.title).join(' | ')}
    - Whale Activity: ${context.whaleActivity || 'N/A'}
    - Fear & Greed Index: ${context.fearGreedIndex || 'N/A'}

    STRATEGY RULES (Crypto Fusion Strategy v3):
    1) Technical Analysis (40%): Market Structure (15%), RSI 38-46 Buy / 66-72 Sell (10%), EMAs 50/200 (10%), Volume Profile (5%).
    2) Behavioral Analysis (40%): Whale Activity (20%), Order Flow (15%), Fear & Greed (5%).
    3) News Analysis (20%): Macro (8%), Regulatory (6%), Asset Specific (6%).
    4) Per-Trade Layer: Signal Strength (30%), Entry Quality (30%), Whale Alignment (25%), Risk Assessment (15%).

    User Question: "${message}"

    Your task:
    1. Perform a detailed analysis based on the Fusion v3 rules.
    2. Provide a clear decision (Buy, Sell, Wait) in Arabic.
    3. Suggest Trade Type (Short, Medium, Long term).
    4. Provide specific SL and TP targets based on current price.
    5. Explain the score breakdown for Technical, Behavioral, and News layers.
    6. Answer in Arabic as requested by the user.

    Format the response beautifully with clear sections and professional trading terminology.
  `;

  try {
    const response = await callGeminiWithRetry({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "عذراً، لم أتمكن من تحليل البيانات حالياً.";
  } catch (error) {
    console.error("Error getting chat response:", error instanceof Error ? error.message : String(error));
    return "حدث خطأ أثناء محاولة الاتصال بمحرك الذكاء الاصطناعي.";
  }
}
