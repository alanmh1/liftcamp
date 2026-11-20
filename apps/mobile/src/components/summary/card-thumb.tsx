import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { thumbLetter, thumbSource } from '@/components/exercise-media';
import { Text } from '@/components/text';
import type { CardPalette } from '@/components/summary/card-palette';
import type { ExerciseMedia } from '@/data/exercise-media';

/**
 * An exercise thumbnail on a share card: the image ExerciseThumb would pick
 * (thumbSource), or its letter tile in the card's colors. The card has its
 * own palette, so it cannot borrow ExerciseThumb, which follows the app's
 * theme.
 *
 * `letter` forces the tile: the capture passes it for any image that had
 * not loaded in time, so the shared image never has a blank square.
 * `onSettled` reports once the square is drawn, image or tile, which is
 * what the capture waits for. `instant` drops the fade, so a capture
 * never catches an image half faded in.
 */
export function CardThumb({
  exercise,
  size,
  radius,
  palette,
  letter = false,
  instant = false,
  onSettled,
}: {
  exercise: ExerciseMedia;
  size: number;
  radius: number;
  palette: CardPalette;
  letter?: boolean;
  instant?: boolean;
  onSettled?: (exerciseId: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const uri = thumbSource(exercise);
  const box = { width: size, height: size, borderRadius: radius, backgroundColor: palette.thumb };

  if (!uri || failed || letter) {
    return (
      <View style={[styles.tile, box]} onLayout={() => onSettled?.(exercise.id)}>
        <Text style={[styles.letter, { color: palette.muted, fontSize: size * 0.4 }]}>{thumbLetter(exercise.name)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      recyclingKey={exercise.id}
      onLoad={() => onSettled?.(exercise.id)}
      onError={() => setFailed(true)}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={instant ? 0 : 150}
      accessibilityIgnoresInvertColors
      style={[styles.tile, box]}
    />
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '700' },
});
