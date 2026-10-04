import { HistoryScreen } from '@/components/history/history-screen';

/**
 * History, pushed from Profile's History row with the social flag: the
 * same screen as the History tab, under the stack's native header.
 */
export default function ProfileHistory() {
  return <HistoryScreen pushed />;
}
