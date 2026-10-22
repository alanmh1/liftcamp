import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * A native choice between a few options. iOS gets an action sheet with a
 * Cancel button; Android gets an alert with one button per option, which
 * a tap outside dismisses. Android alerts hold three buttons at most, which
 * covers every picker that uses this. A `destructive` option shows in red.
 */
export function chooseOption<T>(
  options: { label: string; value: T; destructive?: boolean }[],
  onPick: (value: T) => void,
  title?: string,
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...options.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: options.flatMap((o, i) => (o.destructive ? [i] : [])),
      },
      (index) => {
        if (index < options.length) onPick(options[index].value);
      },
    );
    return;
  }
  Alert.alert(
    title ?? '',
    undefined,
    options.map((o) => ({
      text: o.label,
      style: o.destructive ? ('destructive' as const) : undefined,
      onPress: () => onPick(o.value),
    })),
    { cancelable: true },
  );
}
