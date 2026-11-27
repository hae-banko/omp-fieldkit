// The active OMP host provides this module to extensions at runtime.
declare module "@oh-my-pi/pi-tui/text/width" {
  export function wrap(text: string, width: number): string[];
}
