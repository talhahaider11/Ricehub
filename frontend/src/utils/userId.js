export function parseUserId(value) {
  const normalized = String(value)
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => (
      String(digit.charCodeAt(0) >= 0x06f0
        ? digit.charCodeAt(0) - 0x06f0
        : digit.charCodeAt(0) - 0x0660)
    ))
    .trim();

  const groupedNumber = /^\d{1,3}(?:[,\u066c]\d{3})+$/;
  const containsSeparator = /[,\u066c]/.test(normalized);
  if (containsSeparator && !groupedNumber.test(normalized)) return null;

  if (!/^\d[\d,\u066c]*$/.test(normalized)) return null;
  const userId = Number(normalized.replace(/[,\u066c]/g, ""));
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}
