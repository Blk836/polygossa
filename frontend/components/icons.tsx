import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const BookIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7" /></Icon>
);
export const GlobeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>
);
export const CardsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></Icon>
);
export const ListIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>
);
export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></Icon>
);
export const GridSmallIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3.5 3.5h4v4h-4zM10 3.5h4v4h-4zM16.5 3.5h4v4h-4zM3.5 10h4v4h-4zM10 10h4v4h-4zM16.5 10h4v4h-4zM3.5 16.5h4v4h-4zM10 16.5h4v4h-4zM16.5 16.5h4v4h-4z" /></Icon>
);
export const RowsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="3" y="15" width="6" height="5" rx="1" /><path d="M12 5.5h9M12 8h6M12 16.5h9M12 19h6" /></Icon>
);
export const ChartIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></Icon>
);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 10.5h7M8.5 14h4" /></Icon>
);
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></Icon>
);
export const GearIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>
);
export const SpeakerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Icon>
);
export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m6 4 14 8-14 8z" fill="currentColor" /></Icon>
);
export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" /></Icon>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const HeartIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <Icon {...p}><path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" fill={filled ? "currentColor" : "none"} /></Icon>
);
export const BookmarkIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <Icon {...p}><path d="M6 3h12v18l-6-4-6 4z" fill={filled ? "currentColor" : "none"} /></Icon>
);
export const HeadphonesIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" /></Icon>
);
export const FlameIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-4 4 0-3-1-5-3-7 0 5-3 7-3 12a7 7 0 0 0 7 7z" /></Icon>
);
export const PenIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /><path d="M14 6l4 4" /></Icon>
);
export const VideoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></Icon>
);
export const SkipBackIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M19 20 9 12l10-8z" /><path d="M5 19V5" /></Icon>
);
export const SkipForwardIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m5 4 10 8-10 8z" /><path d="M19 5v14" /></Icon>
);
export const ReplayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>
);
export const RepeatIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></Icon>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const PlaylistIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 6h13M3 11h13M3 16h7" /><path d="m15 14.5 6 3.5-6 3.5z" /></Icon>
);
export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m15 5-7 7 7 7" /></Icon>
);
export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
);
export const MiniPlayerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" /></Icon>
);
export const SideBySideIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="M14 4.5v15" /><path d="M5.5 9h5M5.5 12h5M5.5 15h3" /></Icon>
);
export const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></Icon>
);
