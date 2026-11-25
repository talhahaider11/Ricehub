export async function collectPaginatedResults(
  initialResponse,
  fetchNextPage,
  resourceName
) {
  const results = [];
  const visitedPages = new Set();
  let response = initialResponse;

  while (true) {
    const page = response.data;
    const pageResults = Array.isArray(page) ? page : page?.results;
    if (!Array.isArray(pageResults)) {
      throw new TypeError(`${resourceName} response did not contain a list.`);
    }
    results.push(...pageResults);

    const next = page?.next;
    if (!next) return results;
    if (visitedPages.has(next)) {
      throw new Error(`${resourceName} pagination returned a repeated page.`);
    }
    visitedPages.add(next);
    response = await fetchNextPage(next);
  }
}
