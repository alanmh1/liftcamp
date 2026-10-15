import { useEffect, useState, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

import { useKeyboard, type KeyboardFrame } from '@/lib/use-keyboard';

export type KeyboardOverlap = {
  /** The keyboard, as `useKeyboard` reports it. */
  keyboard: KeyboardFrame;
  /**
   * Whether a docked keyboard is up. Android reports a floating keyboard
   * with a height of 0 or less (its inset minus the navigation bar's).
   */
  docked: boolean;
  /**
   * Points of the view the docked keyboard covers, measured. 0 when the
   * window has already been resized above the keyboard, or with no docked
   * keyboard. Null while the measurement is on its way.
   */
  overlap: number | null;
  /** The view's bottom edge in window coordinates, or null before it is measured. */
  bottom: number | null;
};

/**
 * Android only: how far the keyboard reaches into a view, measured rather
 * than assumed. Under edge-to-edge the window may or may not resize for
 * the keyboard, depending on the Android version and the window, so
 * neither is assumed: the view's bottom (`measureInWindow`) is compared
 * with the keyboard's top (`endCoordinates.screenY`, the top of the visible
 * area), which comes out as 0 when the window was resized and as the
 * covered height when it was not.
 *
 * Measures again whenever the keyboard changes, and whenever `measure`
 * turns true, so a caller can ask for the view's bottom with no keyboard
 * event (a hardware keyboard sends none). On iOS it measures nothing and
 * returns nulls; the screens keep their own iOS handling.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>, measure = false): KeyboardOverlap {
  const keyboard = useKeyboard();
  const docked = keyboard.top != null && keyboard.height > 0;
  const [bottom, setBottom] = useState<number | null>(null);
  const [measuredFor, setMeasuredFor] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!measure && keyboard.top == null) return;
    const top = keyboard.top;
    ref.current?.measureInWindow((_x, y, _w, h) => {
      setBottom(y + h);
      setMeasuredFor(top);
    });
  }, [ref, measure, keyboard.top, keyboard.height]);

  let overlap: number | null = null;
  if (Platform.OS === 'android') {
    if (!docked) overlap = 0;
    else if (bottom != null && measuredFor === keyboard.top) {
      overlap = Math.max(0, Math.round(bottom - (keyboard.top as number)));
    }
  }
  return { keyboard, docked, overlap, bottom: Platform.OS === 'android' ? bottom : null };
}
