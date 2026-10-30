export function getArrayResults(data, resourceName) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  throw new TypeError(`${resourceName} response did not contain a list.`);
}
