import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type KeyboardFrame = {
  /** Points the keyboard covers from the bottom of the window. 0 when hidden. */
  height: number;
  /** The keyboard's top edge in window coordinates, or null when hidden. */
  top: number | null;
};

const HIDDEN: KeyboardFrame = { height: 0, top: null };

/**
 * Where the keyboard is. iOS reports the final frame on `will` events,
 * before the animation, so a layout that follows it lands as the keyboard
 * does; Android only has `did`. `endCoordinates.screenY` is the keyboard's
 * top edge, which is what a scroll-into-view needs, and is in the same
 * space `measureInWindow` reports.
 */
export function useKeyboard(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(HIDDEN);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) =>
      setFrame({ height: e.endCoordinates.height, top: e.endCoordinates.screenY }),
    );
    const hide = Keyboard.addListener(hideEvent, () => setFrame(HIDDEN));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return frame;
}
