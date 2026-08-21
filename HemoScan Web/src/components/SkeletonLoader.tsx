// src/components/SkeletonLoader.tsx
// Shimmer skeleton components for loading states.
// Uses CSS custom properties so they automatically adapt to dark/light mode.
import React from 'react';

// ─── Inline shimmer styles ─────────────────────────────────────────────────────
// Injected once so no separate CSS file is needed.
const shimmerStyle = `
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-1, #1e293b) 25%,
    var(--surface-2, #334155) 37%,
    var(--surface-1, #1e293b) 63%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
}
`;

// ─── Style injector ────────────────────────────────────────────────────────────
let styleInjected = false;
const injectStyle = () => {
  if (styleInjected || typeof document === 'undefined') return;
  const tag = document.createElement('style');
  tag.textContent = shimmerStyle;
  document.head.appendChild(tag);
  styleInjected = true;
};

// ─── Primitives ────────────────────────────────────────────────────────────────
interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
  borderRadius?: string;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 16,
  style,
  borderRadius = '8px',
}) => {
  injectStyle();
  return (
    <div
      className="skeleton"
      role="presentation"
      aria-hidden="true"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
};

// ─── Scan Card Skeleton ────────────────────────────────────────────────────────
export const ScanCardSkeleton: React.FC = () => (
  <div
    role="status"
    aria-label="Loading scan record"
    style={{
      display: 'flex',
      gap: '14px',
      padding: '16px',
      background: 'var(--surface-1)',
      borderRadius: '14px',
      border: '1.5px solid var(--border-subtle)',
      marginBottom: '12px',
    }}
  >
    {/* Thumbnail */}
    <SkeletonBox width={64} height={64} borderRadius="10px" style={{ flexShrink: 0 }} />

    {/* Content */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
      <SkeletonBox width="60%" height={14} />
      <SkeletonBox width="40%" height={12} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <SkeletonBox width={64} height={22} borderRadius="20px" />
        <SkeletonBox width={80} height={22} borderRadius="20px" />
      </div>
    </div>

    {/* Action */}
    <SkeletonBox width={28} height={28} borderRadius="50%" style={{ alignSelf: 'center', flexShrink: 0 }} />
  </div>
);

// ─── Dashboard Stat Card Skeleton ──────────────────────────────────────────────
export const DashboardStatSkeleton: React.FC = () => (
  <div
    role="status"
    aria-label="Loading statistic"
    style={{
      padding: '20px',
      background: 'var(--surface-1)',
      borderRadius: '16px',
      border: '1.5px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SkeletonBox width="45%" height={12} />
      <SkeletonBox width={32} height={32} borderRadius="10px" />
    </div>
    <SkeletonBox width="55%" height={28} borderRadius="6px" />
    <SkeletonBox width="35%" height={10} />
  </div>
);

// ─── Scan History List Skeleton ────────────────────────────────────────────────
export const ScanHistorySkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div role="status" aria-label="Loading scan history" aria-live="polite">
    {Array.from({ length: count }).map((_, i) => (
      <ScanCardSkeleton key={i} />
    ))}
    <span className="sr-only">Loading scan records, please wait…</span>
  </div>
);

// ─── Dashboard Stats Grid Skeleton ────────────────────────────────────────────
export const DashboardSkeletonGrid: React.FC = () => (
  <div
    role="status"
    aria-label="Loading dashboard statistics"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '16px',
    }}
  >
    {[1, 2, 3, 4].map(i => (
      <DashboardStatSkeleton key={i} />
    ))}
  </div>
);

// ─── Profile Card Skeleton ─────────────────────────────────────────────────────
export const ProfileCardSkeleton: React.FC = () => (
  <div
    role="status"
    aria-label="Loading profile"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      background: 'var(--surface-1)',
      borderRadius: '16px',
    }}
  >
    <SkeletonBox width={64} height={64} borderRadius="50%" style={{ flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <SkeletonBox width="50%" height={16} />
      <SkeletonBox width="70%" height={12} />
      <SkeletonBox width="40%" height={12} />
    </div>
  </div>
);

export default SkeletonBox;
