export function validPassword(password: string, confirmation: string): boolean {
  return (
    [...password].length >= 6 &&
    [...password].length <= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    password === confirmation
  );
}
