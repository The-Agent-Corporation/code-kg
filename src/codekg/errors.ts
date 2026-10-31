/** A problem with user-supplied input, reported without a stack trace. */
export class InputError extends Error {
  override name = 'InputError';
}
