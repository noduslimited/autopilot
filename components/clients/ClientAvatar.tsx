import { Avatar, type AvatarSize } from "@/components/ui/Avatar";

// Source: Design System Document section 7.4 ("Client: varied — derived
// from name using a hash function for consistency per client"). The exact
// palette isn't specified in the design doc — these are new pastel pairs,
// applied via Tailwind arbitrary-value classes (not inline styles, per
// CLAUDE.md rule 6) so each is still a real Tailwind class, just not a
// named design-system token.
const PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "bg-[#FDECEA]", text: "text-[#A32D2D]" },
  { bg: "bg-[#EAF3DE]", text: "text-[#27500A]" },
  { bg: "bg-[#E6F1FB]", text: "text-[#0C447C]" },
  { bg: "bg-[#FAEEDA]", text: "text-[#633806]" },
  { bg: "bg-[#EEEDFE]", text: "text-[#3C3489]" },
  { bg: "bg-[#E1F5EE]", text: "text-[#04342C]" },
  { bg: "bg-[#FDE8F3]", text: "text-[#8A1D5C]" },
  { bg: "bg-[#E8F0FE]", text: "text-[#1A3E8C]" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface ClientAvatarProps {
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  className?: string;
}

export function ClientAvatar({ firstName, lastName, size = "md", className = "" }: ClientAvatarProps) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const colours = PALETTE[hashName(`${firstName}${lastName}`) % PALETTE.length];

  return <Avatar initials={initials} bg={colours.bg} text={colours.text} size={size} className={className} />;
}
