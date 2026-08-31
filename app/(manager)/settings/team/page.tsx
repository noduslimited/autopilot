import { createClient } from "@/lib/supabase/server";
import { TeamMembersClient, type TeamMember } from "./TeamMembersClient";
import { StaffPageActions } from "@/app/(manager)/staff/StaffPageActions";

// Source: PRD section 4.10 (Users & access — Team members)
export default async function TeamSettingsPage() {
  const supabase = await createClient();

  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, role, users(first_name, last_name, email, status)")
    .order("id");

  const members: TeamMember[] = (staffRows ?? [])
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!user) return null;
      return {
        id: row.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: row.role as "carer" | "senior_carer" | "manager",
        status: user.status as "active" | "invited" | "deactivated",
      };
    })
    .filter((m): m is TeamMember => m !== null);

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <div className="flex items-center justify-between">
        <h1 className="text-page-heading text-text-primary">Team members</h1>
        <StaffPageActions />
      </div>

      <TeamMembersClient members={members} />
    </div>
  );
}
