// Prompt guidance for UniMate: short English text, one action, no character description.

export const PROMPT_PREFIX = "An object";
export const PROMPT_SOFT_LIMIT = 60;

export const SUGGESTED_ACTIONS = [
  "walks forward",
  "jumps in place",
  "roars",
  "flaps its wings",
  "turns around",
  "squats and stands up",
  "runs forward",
  "attacks forward",
];

const SEQUENCE_WORDS = /\b(then|after|before|while|afterwards|finally)\b/i;
const DESCRIPTIVE_WORDS = /\b(big|small|huge|tiny|red|blue|green|black|white|giant|cute|scary|robot|dragon|shark|eagle|dog|cat|man|woman|character|creature|monster|wearing)\b/i;
const NON_ENGLISH_CHARACTERS = /[áéíóúñ¿¡]/i;

/** Warnings shown under the prompt field (empty list = prompt looks fine). */
export function findPromptWarnings(actionText: string): string[] {
  const trimmedText = actionText.trim();
  const warnings: string[] = [];
  if (trimmedText.length > PROMPT_SOFT_LIMIT) {
    warnings.push(`Es largo (${trimmedText.length} caracteres): el modelo responde mejor a frases cortas.`);
  }
  if (SEQUENCE_WORDS.test(trimmedText) || trimmedText.includes(",")) {
    warnings.push("Parece tener más de una acción: usá una sola, o el Modo Encadenado.");
  }
  if (DESCRIPTIVE_WORDS.test(trimmedText)) {
    warnings.push("No describas al personaje: solo el movimiento.");
  }
  if (NON_ENGLISH_CHARACTERS.test(trimmedText)) {
    warnings.push("El texto tiene que estar en inglés.");
  }
  return warnings;
}

/** The full prompt sent to the model: "An object <action>." */
export function buildFullPrompt(actionText: string): string {
  const cleanedAction = actionText.trim().replace(/\.+$/, "");
  return `${PROMPT_PREFIX} ${cleanedAction}.`;
}
