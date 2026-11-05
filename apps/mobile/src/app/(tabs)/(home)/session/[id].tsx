import { WorkoutDetailView } from '@/components/history/workout-detail-view';

/**
 * A workout opened from an exercise on Home's stack, so Back returns to the
 * exercise. Not `workout/[id]`: in this group that path is the root modal's.
 */
export default WorkoutDetailView;
