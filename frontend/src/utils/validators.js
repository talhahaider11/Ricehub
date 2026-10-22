export function required(
  value
) {
  return Boolean(
    value?.trim()
  );
}

export function validEmail(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

export function passwordStrength(
  value
) {
  if (!value) {
    return false;
  }

  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value)
  );
}

export function validImage(
  file
) {
  if (!file) {
    return true;
  }

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  return (
    allowed.includes(
      file.type
    ) &&
    file.size <=
      5 * 1024 * 1024
  );
}