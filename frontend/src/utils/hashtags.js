export function extractHashtags(text) {
  if (!text) return [];

  const matches =
    text.match(
      /#[a-zA-Z0-9_]+/g
    );

  return matches
    ? matches.map((tag) =>
        tag.substring(1).toLowerCase()
      )
    : [];
}