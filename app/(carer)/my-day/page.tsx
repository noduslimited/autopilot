import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { CarerHeaderIcons } from "@/components/carer/CarerHeaderIcons";
import { MyDayClient, type MyDayVisit } from "./MyDayClient";
import { ukDateISO, ukDayRange } from "@/lib/utils/time";

// Source: PRD section 5.2 (My Day)

// UK calendar date (Europe/London), held at UTC midnight so date arithmetic stays simple.
function startOfTodayUTC(): Date {
  return new Date(`${ukDateISO()}T00:00:00Z`);
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
    .gte("scheduled_start", ukDayRange(ukDateISO()).start)
    .lt("scheduled_start", ukDayRange(ukDateISO()).end)
    .order("scheduled_start", { ascending: true });

  // Supabase's embedded-relation typing can return either a single object
  // or an array depending on how it infers the FK's cardinality — normalise
  // defensively, same pattern as Session 8's staff/users export join.
  // Also filters out (rather than crashing on) a visit whose embedded
  // client came back null — belt-and-braces on top of the RLS fix
  // (20260915090000) for a carer covering a reassigned visit whose
  // client isn't their own.
  const typedVisits: MyDayVisit[] = (visits ?? [])
    .map((visit) => {
      const client = Array.isArray(visit.client) ? visit.client[0] : visit.client;
      return client ? ({ ...visit, client } as MyDayVisit) : null;
    })
    .filter((v): v is MyDayVisit => v !== null);

  const total = typedVisits.length;
  const done = typedVisits.filter((v) => v.status === "completed").length;
  const active = typedVisits.filter((v) => v.status === "in_progress").length;
  const upcoming = typedVisits.filter((v) => v.status === "scheduled").length;

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

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
