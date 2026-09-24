import ProjectDetailView from '@/components/ProjectDetailView';

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ProjectDetailView projectId={params.id} />;
}
