"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

export interface StaffListItem {
  id: string;
  name: string;
  role: "carer" | "senior_carer" | "manager";
  dbsStatus: "valid" | "expiring_soon" | "expired";
  trainingStatus: "current" | "due_soon" | "overdue";
  status: "on_shift" | "off_today" | "sick_leave" | "on_leave";
}

const ROLE_LABELS: Record<StaffListItem["role"], string> = {
  carer: "Carer",
  senior_carer: "Senior carer",
  manager: "Manager",
};

const DBS_BADGE: Record<StaffListItem["dbsStatus"], { label: string; variant: BadgeVariant }> = {
  valid: { label: "Valid", variant: "valid" },
  expiring_soon: { label: "Expiring soon", variant: "dueSoon" },
  expired: { label: "Expired", variant: "atRisk" },
};

const TRAINING_BADGE: Record<StaffListItem["trainingStatus"], { label: string; variant: BadgeVariant }> = {
  current: { label: "Current", variant: "valid" },
  due_soon: { label: "Due soon", variant: "dueSoon" },
  overdue: { label: "Overdue", variant: "atRisk" },
};

const STATUS_BADGE: Record<StaffListItem["status"], { label: string; variant: BadgeVariant }> = {
  on_shift: { label: "On shift", variant: "onShift" },
  off_today: { label: "Off today", variant: "notStarted" },
  sick_leave: { label: "Sick leave", variant: "atRisk" },
  on_leave: { label: "On leave", variant: "pending" },
};

export function StaffListClient({ staff }: { staff: StaffListItem[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((s) => {
      const matchesSearch = query === "" || s.name.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || s.role === roleFilter;
      const matchesCompliance =
        complianceFilter === "all" ||
        (complianceFilter === "up_to_date" && s.dbsStatus === "valid" && s.trainingStatus === "current") ||
        (complianceFilter === "overdue" && (s.dbsStatus === "expired" || s.trainingStatus === "overdue")) ||
        (complianceFilter === "due_soon" && (s.dbsStatus === "expiring_soon" || s.trainingStatus === "due_soon"));
      return matchesSearch && matchesRole && matchesCompliance;
    });
  }, [staff, search, roleFilter, complianceFilter]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <i className="ti ti-search absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff…"
            className="w-full rounded-input border border-border-default bg-card-bg py-[9px] pr-3 pl-9 text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All roles</option>
          <option value="carer">Carer</option>
          <option value="senior_carer">Senior carer</option>
          <option value="manager">Manager</option>
        </select>
        <select
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All compliance</option>
          <option value="up_to_date">Up to date</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due soon</option>
        </select>
      </div>

      {staff.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No staff added yet. Invite your first team member.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No staff match your search. Try different filters.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border-default bg-card-bg">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border-default text-left text-label text-text-secondary">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">DBS</th>
                <th className="py-2.5 px-4">Training</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const dbs = DBS_BADGE[s.dbsStatus];
                const training = TRAINING_BADGE[s.trainingStatus];
                const status = STATUS_BADGE[s.status];
                return (
                  <tr key={s.id} className="border-b border-border-default last:border-b-0">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={initialsOf(s.name)}
                          variant={s.role === "manager" ? "manager" : "carer"}
                          size="sm"
                        />
                        <span className="text-body font-medium text-text-primary">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-body text-text-secondary">{ROLE_LABELS[s.role]}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant={dbs.variant}>{dbs.label}</Badge>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={training.variant}>{training.label}</Badge>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link
                        href={`/staff/${s.id}`}
                        className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
