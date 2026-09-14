import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type MediaExercise = Pick<ExerciseInfo, 'id' | 'name' | 'gif_url_sm' | 'gif_url' | 'image_url'>;

/**
 * The first available source for an exercise. `animated` prefers the 360px
 * GIF for the info sheet; the thumbnail wants the 180px one.
 */
function pickSource(ex: MediaExercise, animated: boolean): string | null {
  return (animated ? ex.gif_url : ex.gif_url_sm) ?? ex.image_url ?? null;
}

/**
 * Neutral tile with the exercise's first letter, for the 16 rows with no
 * media at all and for anything that fails to load.
 */
function LetterTile({ name, size, big }: { name: string; size: number; big: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: c.surface2 }]}>
      <Text style={[styles.letter, { color: c.text3, fontSize: big ? 48 : 18 }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * The 48pt leading thumbnail in list rows.
 *
 * autoplay is off, so a GIF shows its first frame and never animates in a
 * list; 898 animating GIFs would not scroll. recyclingKey ties the decoded
 * frame to this exercise so a recycled row does not briefly show the old
 * image, and the surface2 background plus a short fade covers the load so
 * rows do not flash.
 */
export function ExerciseThumb({ exercise, size = 48 }: { exercise: MediaExercise; size?: number }) {
  const c = useColors();
  const [failed, setFailed] = useState(false);
  const uri = pickSource(exercise, false);
  if (!uri || failed) return <LetterTile name={exercise.name} size={size} big={false} />;
  return (
    <Image
      source={{ uri }}
      recyclingKey={exercise.id}
      onError={() => setFailed(true)}
      autoplay={false}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
      accessibilityIgnoresInvertColors
      style={[styles.tile, { width: size, height: size, backgroundColor: c.surface2 }]}
    />
  );
}

/**
 * The animation in the info sheet.
 *
 * expo-image renders nothing for an animated file until the whole thing is
 * decoded, and the 360px GIF averages 283KB, so on its own the hero sat blank
 * for a beat. The 180px GIF is passed as the placeholder: the picker has
 * almost always already cached it, so its first frame appears at once and the
 * full animation swaps in over it when ready. A spinner sits over the image
 * until then.
 *
 * Rendered at the full sheet width, which keeps it well above the small-image
 * threshold where expo-image on iOS has been seen not to animate.
 */
export function ExerciseHero({ exercise, size }: { exercise: MediaExercise; size: number }) {
  const c = useColors();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const uri = pickSource(exercise, true);
  if (!uri || failed) return <LetterTile name={exercise.name} size={size} big />;

  // Only a real thumbnail is a useful placeholder. When the full source is
  // already the small GIF or the photo there is nothing smaller to show first.
  const placeholder = exercise.gif_url_sm && exercise.gif_url_sm !== uri ? exercise.gif_url_sm : null;

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={{ uri }}
        placeholder={placeholder ? { uri: placeholder } : undefined}
        placeholderContentFit="contain"
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        autoplay
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={200}
        accessibilityIgnoresInvertColors
        style={[styles.tile, { width: size, height: size, backgroundColor: c.surface2 }]}
      />
      {!ready ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator size="small" color={c.text2} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.input,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontWeight: '700' },
  spinner: {
    position: 'absolute',
    right: 10,
    bottom: 10,
  },
});
