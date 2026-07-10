export function buildDeedExtractionPrompt(deedText: string): string {
  return `You are extracting structured property data from a Dubai Land Department (DLD) title deed.

The text below was extracted from a PDF title deed. Extract ONLY the fields that are explicitly present in the document. Return null for any field you cannot find — DO NOT guess, infer, or hallucinate values.

Return a single JSON object with these fields (all nullable):

{
  "name": "string | null — property description, plot number, or unit identifier",
  "subcategory": "\"off_plan\" | \"existing\" | null — off_plan if the deed mentions an under-construction or incomplete property, existing if already built/registered",
  "property_type": "\"apartment\" | \"penthouse\" | \"townhouse\" | \"villa\" | \"farm\" | \"commercial\" | null",
  "bedrooms": "\"Studio\" | \"1BR\" | \"2BR\" | \"3BR\" | \"4BR\" | \"5BR\" | \"+5BR\" | null",
  "city": "string | null — e.g. \"Dubai\", \"Abu Dhabi\"",
  "area": "string | null — the community/district name, e.g. \"Dubai Marina\", \"Palm Jumeirah\"",
  "developer": "string | null — the developer company name, e.g. \"Emaar\", \"Damac\"",
  "size_sqft": "number | null — property size in square feet. If the deed gives square meters, convert to sqft (× 10.7639). Round to the nearest integer.",
  "purchase_price_aed": "number | null — the purchase price in AED as a decimal number. Do NOT include currency symbols, commas, or spaces.",
  "purchased_at": "string | null — ISO date YYYY-MM-DD of the purchase/registration date"
}

RULES:
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.
- If the deed Is in Arabic, translate field values to English.
- Dates in the deed may be DD/MM/YYYY — convert them to ISO YYYY-MM-DD.
- If a field value is ambiguous between two valid enum values, pick the closest match.
- Do NOT wrap the JSON in markdown code blocks.

Title deed text:
${deedText}`;
}
