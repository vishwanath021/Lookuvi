/** A photo only saves. The preview starts when this is true and the guest presses Try now. */
export function tryNowReady(photo: boolean, required: boolean) {
  return photo && required;
}
