import getApiError from "../utils/getApiError";


export default function getApiError(
  error,
  fallback = "Something went wrong."
) {
  const data =
    error?.response?.data;

  if (!data) {
    return fallback;
  }

  if (typeof data.errors === "string") {
    return data.errors;
  }

  if (
    typeof data.errors === "object"
  ) {
    return Object.values(
      data.errors
    )
      .flat()
      .join(" ");
  }

  if (data.detail) {
    return data.detail;
  }

  return fallback;
}