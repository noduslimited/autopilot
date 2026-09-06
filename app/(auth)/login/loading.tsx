import { AuthCardSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <AuthCardSkeleton />
    </div>
  );
}

