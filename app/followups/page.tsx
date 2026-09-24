import { Suspense } from 'react';
import FollowupsView from '@/components/FollowupsView';
export default function FollowupsPage() {
	return <Suspense fallback={<div className="work-muted">Loading follow-ups...</div>}><FollowupsView /></Suspense>;
}
