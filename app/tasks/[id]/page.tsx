import TaskDetailView from '@/components/TaskDetailView';

export default async function TaskDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <TaskDetailView taskId={params.id} />;
}
