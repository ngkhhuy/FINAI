/**
 * PII masking utility.
 * Masks phone numbers, emails, SSN/ID patterns, street addresses, and dates of birth
 * before any text is stored in logs or transcripts.
 */

const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // Email
  {
    name: "email",
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
  // US/International phone: (123) 456-7890 / +1-123-456-7890 / 1234567890
  {
    name: "phone",
    regex: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
    replacement: "[PHONE]",
  },
  // SSN: 123-45-6789 or 123456789
  {
    name: "ssn",
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN]",
  },
  // Date of birth: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD
  {
    name: "dob",
    regex: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
    replacement: "[DOB]",
  },
  // Street address: 123 Main St, 456 Oak Avenue
  {
    name: "address",
    regex: /\b\d+\s+[A-Za-z0-9\s]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b\.?/gi,
    replacement: "[ADDRESS]",
  },
];

export function maskPII(text: string): string {
  let masked = text;
  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern.regex, pattern.replacement);
  }
  return masked;
}

export function containsPII(text: string): boolean {
  return PII_PATTERNS.some((p) => p.regex.test(text));
}
