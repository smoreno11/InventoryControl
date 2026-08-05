/** Thin DOM query helpers. */

/**
 * Query a single element, asserting it exists.
 *
 * The non-null assertion is deliberate: every call site targets markup this app
 * just rendered, so a miss is a programming error that should surface loudly as
 * a TypeError rather than being silently ignored.
 */
export function q<T extends Element>(sel: string, root: Element | Document = document): T {
  return root.querySelector<T>(sel)!;
}

/** Query all matching elements as a real array. */
export function qa<T extends Element>(sel: string, root: Element | Document = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

/**
 * Attach a delegated listener: one listener on a container that handles events
 * from any descendant matching `selector`, including ones rendered later.
 *
 * This replaces the previous `onclick="__someGlobal('...')"` attributes, which
 * required exposing functions on `window` and interpolating JSON into markup.
 */
export function delegate<E extends keyof HTMLElementEventMap>(
  root: Element,
  type: E,
  selector: string,
  handler: (el: HTMLElement, ev: HTMLElementEventMap[E]) => void,
): void {
  root.addEventListener(type, (ev) => {
    const target = ev.target as HTMLElement | null;
    const match = target?.closest<HTMLElement>(selector);
    if (match && root.contains(match)) {
      handler(match, ev as HTMLElementEventMap[E]);
    }
  });
}
