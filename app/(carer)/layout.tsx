import { CarerShell } from "@/components/layout/CarerShell";

export default function CarerLayout({ children }: { children: React.ReactNode }) {
  return <CarerShell>{children}</CarerShell>;
}
