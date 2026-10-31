export function getArrayResults(data, resourceName) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (typeof data?.detail === "string") {
    throw new Error(data.detail);
  }

  if (typeof data?.error === "string") {
    throw new Error(data.error);
  }

  throw new TypeError(`${resourceName} response did not contain a list.`);
}
