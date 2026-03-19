// apps/web/src/app/[org]/dashboard/page.tsx
interface Props { params: Promise<{ org: string }> }

export default async function DashboardPage({ params }: Props) {
  const { org } = await params
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to {org}. Knowledge view coming soon.</p>
    </div>
  )
}
