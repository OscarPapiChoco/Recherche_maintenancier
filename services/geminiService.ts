
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const diagnoseIssue = async (userInput: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `L'utilisateur au Cameroun a le problème suivant : "${userInput}". 
      En tant qu'assistant de maintenance professionnel local, 
      identifie la catégorie de maintenance appropriée (parmi : plumbing, electrical, hvac, appliance, locksmith, general) 
      et donne un court conseil adapté au contexte camerounais (ex: attention aux baisses de tension).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "La clé de la catégorie (ex: plumbing)",
            },
            explanation: {
              type: Type.STRING,
              description: "Explication courte et rassurante.",
            },
            urgency: {
              type: Type.STRING,
              description: "Niveau d'urgence: Bas, Moyen, Haut",
            }
          },
          required: ["category", "explanation", "urgency"]
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const refineLocation = async (locationInput: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `L'utilisateur a saisi la localisation suivante au Cameroun : "${locationInput}". 
      Propose une adresse plus précise incluant une ville camerounaise et un quartier connu. 
      Exemple: Si "Douala", propose "Douala, Akwa" ou "Douala, Bonanjo". Si "Yaoundé", propose "Yaoundé, Bastos".
      Retourne uniquement un format "Ville, Quartier".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedAddress: {
              type: Type.STRING,
              description: "L'adresse formatée (Ville, Quartier)",
            }
          },
          required: ["refinedAddress"]
        },
      },
    });
    return JSON.parse(response.text || '{}').refinedAddress;
  } catch (error) {
    console.error("Gemini Location Error:", error);
    return locationInput;
  }
};
