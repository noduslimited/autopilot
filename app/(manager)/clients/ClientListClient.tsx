"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { CriticalBadges } from "@/components/clients/CriticalBadges";

export interface ClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  nhsNumber: string | null;
  address: string;
  careType: string;
  assignedCarerId: string | null;
  assignedCarerName: string | null;
  riskLevel: "low" | "medium" | "high";
  allergies: string[];
  dietaryRequirements: string | null;
  dnacpr: boolean;
  statusLabel: "Care plan current" | "Action needed" | "Review due" | "Visit in progress";
  nextVisitTime: string | null;
}

const CARE_TYPE_LABELS: Record<string, string> = {
  domiciliary: "Domiciliary",
  residential: "Residential",
  supported_living: "Supported living",
};

const DEFAULT_VISIBLE = 5;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ClientListClient({ clients }: { clients: ClientListItem[] }) {
  const [search, setSearch] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = clients.filter((client) => {
      const matchesSearch =
        query === "" ||
        client.firstName.toLowerCase().includes(query) ||
        client.lastName.toLowerCase().includes(query) ||
        (client.nhsNumber ?? "").toLowerCase().includes(query) ||
        client.address.toLowerCase().includes(query);

      const matchesCareType = careTypeFilter === "all" || client.careType === careTypeFilter;
      const matchesRisk = riskFilter === "all" || client.riskLevel === riskFilter;

      return matchesSearch && matchesCareType && matchesRisk;
    });

    // NO CARER clients sorted to top (PRD section 4.3).
    result = [...result].sort((a, b) => {
      const aNoCarer = a.assignedCarerId ? 0 : 1;
      const bNoCarer = b.assignedCarerId ? 0 : 1;
      return bNoCarer - aNoCarer;
    });

    return result;
  }, [clients, search, careTypeFilter, riskFilter]);

  const visible = showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hasFilters = search.trim() !== "" || careTypeFilter !== "all" || riskFilter !== "all";

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Clients</h1>
          <p className="mt-1 text-secondary text-text-secondary">{clients.length} active service users</p>
        </div>
        <Link href="/clients/new" className="rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white">
          Add client
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <i className="ti ti-search absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clients…"
            className="w-full rounded-input border border-border-default bg-card-bg py-[9px] pr-3 pl-9 text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>
        <select
          value={careTypeFilter}
          onChange={(event) => setCareTypeFilter(event.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All care types</option>
          <option value="domiciliary">Domiciliary</option>
          <option value="residential">Residential</option>
          <option value="supported_living">Supported living</option>
        </select>
        <select
          value={riskFilter}
          onChange={(event) => setRiskFilter(event.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All risks</option>
          <option value="high">High risk</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {clients.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No clients yet. Add your first service user to get started.</p>
          <Link href="/clients/new" className="mt-3 inline-block rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white">
            Add client
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No clients match your search. Try different filters or add a new client.</p>
          <Link href="/clients/new" className="mt-3 inline-block rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white">
            Add client
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((client) => {
            const noCarer = !client.assignedCarerId;
            return (
              <div
                key={client.id}
                className={[
                  "flex items-center justify-between gap-3 rounded-card border py-3.5 px-4",
                  noCarer ? "border-danger-red-border bg-danger-red-light" : "border-border-default bg-card-bg",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ClientAvatar firstName={client.firstName} lastName={client.lastName} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/clients/${client.id}`} className="text-body font-medium text-text-primary hover:underline">
                        {client.firstName} {client.lastName}
                      </Link>
                      <CriticalBadges
                        client={{
                          allergies: client.allergies,
                          dietary_requirements: client.dietaryRequirements,
                          dnacpr: client.dnacpr,
                          risk_level: client.riskLevel,
                          assigned_carer_id: client.assignedCarerId,
                        }}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-secondary text-text-secondary">
                      {client.age} yrs · {CARE_TYPE_LABELS[client.careType] ?? client.careType} ·{" "}
                      {client.assignedCarerName ?? "No carer assigned"}
                      {client.nextVisitTime ? ` · Next visit ${formatTime(client.nextVisitTime)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={[
                      "hidden text-secondary sm:inline",
                      client.statusLabel === "Action needed" ? "text-nhs-red" : "text-text-secondary",
                    ].join(" ")}
                  >
                    {client.statusLabel}
                  </span>
                  {noCarer ? (
                    <Link
                      href={`/clients/${client.id}`}
                      className="rounded-btn bg-danger-red px-3.5 py-[7px] text-[12px] font-medium text-white"
                    >
                      Assign carer
                    </Link>
                  ) : (
                    <Link
                      href={`/clients/${client.id}`}
                      className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {!showAll && filtered.length > DEFAULT_VISIBLE ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 text-body text-nhs-blue"
            >
              Show all {filtered.length} clients
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
