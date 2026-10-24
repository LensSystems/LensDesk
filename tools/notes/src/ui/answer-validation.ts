export function validAnswer(value: string): boolean {
  const length = [...value.trim()].length;
  return length >= 2 && length <= 20;
}
