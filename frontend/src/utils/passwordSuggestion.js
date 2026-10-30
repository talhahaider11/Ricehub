const characterGroups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*()-_=+",
];

export function createPasswordSuggestion(length = 18) {
  if (!Number.isInteger(length) || length < characterGroups.length) {
    throw new RangeError("Password suggestion length is too short.");
  }

  const randomValues = new Uint32Array(length);
  globalThis.crypto.getRandomValues(randomValues);

  const passwordCharacters = characterGroups.map(
    (group, index) => group[randomValues[index] % group.length]
  );
  const allCharacters = characterGroups.join("");

  for (let index = characterGroups.length; index < length; index += 1) {
    passwordCharacters.push(
      allCharacters[randomValues[index] % allCharacters.length]
    );
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index],
    ];
  }

  return passwordCharacters.join("");
}
