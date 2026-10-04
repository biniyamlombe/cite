/** Fixed landlord letter templates filled from check/lookup facts. */
export function rentIncreaseLetter(opts: {
  addressLine: string;
  asOf: string;
  currentRent: number;
  newRent: number;
  increasePct: number;
  capPct?: number;
  overAmount?: number;
  citation?: string;
  quote?: string;
  locale: "en-US" | "es-US";
}): string {
  const {
    addressLine,
    asOf,
    currentRent,
    newRent,
    increasePct,
    capPct,
    overAmount,
    citation,
    quote,
    locale,
  } = opts;

  if (locale === "es-US") {
    return [
      "Asunto: Pregunta sobre el aumento de renta propuesto",
      "",
      `Propiedad: ${addressLine}`,
      `Fecha de referencia: ${asOf}`,
      "",
      `Entiendo que la renta pasaría de $${currentRent.toFixed(2)} a $${newRent.toFixed(2)} (${increasePct}%).`,
      capPct != null
        ? `Según la fuente citada, el tope indicado es ${capPct}%.${
            overAmount != null ? ` Eso sería unos $${overAmount.toFixed(2)} por encima del tope.` : ""
          }`
        : "No pude confirmar un tope numérico a partir de las normas recuperadas.",
      "",
      citation ? `Cita: ${citation}` : "",
      quote ? `Texto fuente: "${quote}"` : "",
      "",
      "Esto no es asesoría legal. Solicito una explicación por escrito del aumento y la base legal.",
      "",
      "Atentamente,",
      "[Su nombre]",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
  }

  return [
    "Subject: Question about the proposed rent increase",
    "",
    `Property: ${addressLine}`,
    `As-of date: ${asOf}`,
    "",
    `I understand rent would change from $${currentRent.toFixed(2)} to $${newRent.toFixed(2)} (${increasePct}%).`,
    capPct != null
      ? `Based on the cited source, the stated cap is ${capPct}%.${
          overAmount != null ? ` That appears about $${overAmount.toFixed(2)} over the cap.` : ""
        }`
      : "I could not confirm a numeric cap from the retrieved rules.",
    "",
    citation ? `Citation: ${citation}` : "",
    quote ? `Source text: "${quote}"` : "",
    "",
    "This is not legal advice. Please provide a written explanation of the increase and its legal basis.",
    "",
    "Sincerely,",
    "[Your name]",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}
