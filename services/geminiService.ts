import { GoogleGenAI } from "@google/genai";
import { InventoryItem } from "../types";

// Initialize the client
// Safe access to process.env to prevent ReferenceError in browser if polyfill fails
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeInventory = async (items: InventoryItem[]): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing. Please configure the environment variable.";
  }

  try {
    // We strictly follow the model guidelines. 'gemini-2.5-flash' is suitable for text tasks.
    const model = 'gemini-2.5-flash';
    
    // Prepare a summarized version of the inventory to save tokens if the list is huge
    const summary = items.slice(0, 200).map(i => `- Part: ${i.part}, Bin: ${i.bin}, Qty: ${i.qty}`).join('\n');
    const totalItems = items.length;
    
    const prompt = `
      You are an expert Inventory Analyst for a warehouse system called ZEEVRA.
      
      Here is a sample of the current inventory (Total unique items: ${totalItems}):
      
      ${summary}
      ${items.length > 200 ? '...(list truncated for brevity)...' : ''}
      
      Please provide a concise, actionable analysis in Markdown format:
      1. **Stock Health**: Identify any items with suspicious quantities (0, negative, or unusually high).
      2. **Organization**: Comment on the bin locations (Are they well grouped? Do the prefixes make sense?).
      3. **Recommendations**: Suggest 2-3 specific actions to improve inventory accuracy based on this data.
      4. **Summary**: A one-sentence status overview.

      Keep the tone professional yet helpful. Use bullet points and bold text for readability.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful and precise warehouse logistics AI assistant.",
        temperature: 0.3, // Lower temperature for more analytical results
      }
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to analyze inventory. Please check your connection or API limit.";
  }
};

export const askGemini = async (question: string, contextItems: InventoryItem[]): Promise<string> => {
     if (!apiKey) return "API Key missing.";

     const context = contextItems.slice(0, 50).map(i => `${i.part} (${i.qty} in ${i.bin})`).join(', ');

     try {
         const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: `Context: Inventory includes ${context}. Question: ${question}`,
         });
         return response.text || "No response.";
     } catch (e) {
         return "Error communicating with AI.";
     }
}