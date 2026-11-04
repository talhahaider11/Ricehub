import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countryOptions = getCountries()
  .map((country) => ({
    country,
    callingCode: `+${getCountryCallingCode(country)}`,
    name: countryNames.of(country) || country,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
export const defaultCountry = countryOptions.find(
  ({ country }) => country === (navigator.language || "").split("-")[1]?.toUpperCase()
)?.country || "PK";

export function getCountryFromPhone(phoneNumber) {
  if (!phoneNumber?.startsWith("+")) return "PK";
  return countryOptions.find(
    ({ callingCode }) => phoneNumber.startsWith(callingCode)
  )?.country || "PK";
}

export function toInternationalPhone(localNumber, country) {
  const parsed = parsePhoneNumberFromString(String(localNumber || ""), country);
  if (parsed?.number) return parsed.number;
  const callingCode = `+${getCountryCallingCode(country)}`;
  const digits = String(localNumber || "").replace(/\D/g, "");
  const nationalNumber = digits.replace(/^0+/, "");
  return `${callingCode}${nationalNumber}`;
}
