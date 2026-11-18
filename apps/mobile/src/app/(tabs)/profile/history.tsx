import { useLocalSearchParams } from 'expo-router';

import { HistoryScreen } from '@/components/history/history-screen';

/**
 * History, pushed from Profile (the History row, the month calendar's
 * History pill, or a tapped day with `date`), under the stack's native
 * header.
 */
export default function ProfileHistory() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <HistoryScreen initialDate={typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} />;
}
