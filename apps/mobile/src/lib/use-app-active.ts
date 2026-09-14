import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * True while the app is in the foreground.
 *
 * The workout screen stays open for the length of a session, often 45
 * minutes, and it now carries animated thumbnails. Looping GIFs in a pocket
 * is wasted battery, so anything animating on that screen reads this and
 * pauses when the app goes to the background.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
