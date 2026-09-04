import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { CarerHeaderIcons } from "@/components/carer/CarerHeaderIcons";
import { MyDayClient, type MyDayVisit } from "./MyDayClient";

// Source: PRD section 5.2 (My Day)

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function MyDayPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: carer } = await supabase
    .from("users")
    .select("id, first_name, last_name, org_id")
    .eq("id", authUser!.id)
    .single();

  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const { data: visits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_start, scheduled_end, status, tasks_total, tasks_completed, client:clients(id, first_name, last_name, address, allergies, dietary_requirements, dnacpr, risk_level, assigned_carer_id)",
    )
    .eq("assigned_carer_id", carer!.id)
    .gte("scheduled_start", todayStart.toISOString())
    .lt("scheduled_start", todayEnd.toISOString())
    .order("scheduled_start", { ascending: true });

  // Supabase's embedded-relation typing can return either a single object
  // or an array depending on how it infers the FK's cardinality — normalise
  // defensively, same pattern as Session 8's staff/users export join.
  const typedVisits: MyDayVisit[] = (visits ?? []).map((visit) => {
    const client = Array.isArray(visit.client) ? visit.client[0] : visit.client;
    return { ...visit, client } as MyDayVisit;
  });

  const total = typedVisits.length;
  const done = typedVisits.filter((v) => v.status === "completed").length;
  const active = typedVisits.filter((v) => v.status === "in_progress").length;
  const upcoming = typedVisits.filter((v) => v.status === "scheduled").length;

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <Header
        title="My day"
        subtitle={`${carer!.first_name} ${carer!.last_name} · ${dateLabel}`}
        right={<CarerHeaderIcons userId={carer!.id} firstName={carer!.first_name} lastName={carer!.last_name} />}
      >
        <div className="grid grid-cols-4 gap-2 rounded-input bg-black/15 p-2">
          <div className="text-center">
            <p className="text-[18px] font-bold text-white">{total}</p>
            <p className="text-tiny text-white/70">Total</p>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#9FE1CB]">{done}</p>
            <p className="text-tiny text-white/70">Done</p>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#FAC775]">{active}</p>
            <p className="text-tiny text-white/70">Active</p>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-white">{upcoming}</p>
            <p className="text-tiny text-white/70">Upcoming</p>
          </div>
        </div>
      </Header>

      <MyDayClient visits={typedVisits} />
    </div>
  );
}
