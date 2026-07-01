import { STATUS_LABELS } from "@/lib/api";

export default function StatusPill({ status }) {
  return (
    <span className={`pill pill-${status}`} data-testid={`status-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function RoomChip({ roomId, roomName }) {
  const cls = roomId === "labor-2" ? "room-labor-2" : "room-labor-1";
  return (
    <span className={`${cls} inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm`}>
      {roomName}
    </span>
  );
}
