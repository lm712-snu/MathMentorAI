import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, AgentMemory, Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL_NAME = "gemini-3-flash-preview";

export const tutorAgent = {
  async explain(topic: string, profile: UserProfile, memory: AgentMemory | null) {
    const prompt = `You are MathMentor, an expert AI mathematics tutor. 
    Topic: ${topic}
    Student Profile: ${JSON.stringify(profile)}
    Student Memory: ${JSON.stringify(memory)}
    
    Explain the concept in a way that matches the student's level. Use LaTeX for math. 
    Keep it engaging and educational. Provide 1 clear example. Use markdown for formatting.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text;
  }
};

export const assessmentAgent = {
  async generateQuestions(topic: string, difficulty: string, count: number = 3): Promise<Question[]> {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ 
        parts: [{ 
          text: `Generate ${count} math questions for topic: ${topic} at ${difficulty} level.` 
        }] 
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse questions", e);
      return [];
    }
  }
};

export const plannerAgent = {
  async recommendNext(memory: AgentMemory | null, currentTopic: string) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ 
        parts: [{ 
          text: `Based on the student's progress and current topic: ${currentTopic}, recommend the next mathematical topic to learn. 
          Memory: ${JSON.stringify(memory)}` 
        }] 
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nextTopic: { type: Type.STRING },
            reason: { type: Type.STRING },
            difficulty: { type: Type.STRING }
          },
          required: ["nextTopic", "reason", "difficulty"]
        }
      }
    });

    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { nextTopic: "Calculus Basics", reason: "Natural progression", difficulty: "Intermediate" };
    }
  }
};
