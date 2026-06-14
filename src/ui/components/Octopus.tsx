export type OctopusMood = 'happy' | 'worried' | 'neutral';

interface OctopusProps {
  mood?: OctopusMood;
  size?: number;
  className?: string;
}

export function Octopus({ mood = 'neutral', size = 120, className }: OctopusProps) {
  const mouth =
    mood === 'happy'
      ? 'M 46,65 Q 60,76 74,65'
      : mood === 'worried'
        ? 'M 47,70 Q 60,61 73,70'
        : 'M 48,66 Q 60,71 72,66';

  const leftPupilX  = mood === 'worried' ? 42 : 46;
  const rightPupilX = mood === 'worried' ? 74 : 78;
  const leftShineX  = mood === 'worried' ? 45 : 49;
  const rightShineX = mood === 'worried' ? 77 : 81;

  return (
    <svg
      viewBox="0 0 120 148"
      width={size}
      height={(size * 148) / 120}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ── 촉수 (body 뒤) ── */}
      <path d="M 24,66 C 10,82 6,104 18,118 C 22,124 18,130 14,128"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 33,74 C 22,90 20,110 30,122 C 34,128 30,134 26,132"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 42,80 C 34,96 32,115 42,124 C 46,130 42,136 38,134"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 52,84 C 46,100 46,118 54,126 C 58,132 54,138 50,136"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 68,84 C 74,100 74,118 66,126 C 62,132 66,138 70,136"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 78,80 C 86,96 88,115 78,124 C 74,130 78,136 82,134"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 87,74 C 98,90 100,110 90,122 C 86,128 90,134 94,132"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M 96,66 C 110,82 114,104 102,118 C 98,124 102,130 106,128"
        fill="none" stroke="#2563eb" strokeWidth="6.5" strokeLinecap="round"/>

      {/* ── 몸통 ── */}
      <ellipse cx="60" cy="47" rx="40" ry="37" fill="#2563eb"/>
      {/* 광택 하이라이트 */}
      <ellipse cx="48" cy="28" rx="14" ry="9" fill="#60a5fa" opacity="0.45"/>

      {/* ── 걱정 눈썹 ── */}
      {mood === 'worried' && (
        <>
          <path d="M 32,28 Q 41,23 48,27" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 72,27 Q 79,23 88,28" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      )}

      {/* ── 눈 흰자 ── */}
      <circle cx="44" cy="40" r="11" fill="white"/>
      <circle cx="76" cy="40" r="11" fill="white"/>
      {/* 동공 */}
      <circle cx={leftPupilX}  cy="41" r="6.5" fill="#1e1b4b"/>
      <circle cx={rightPupilX} cy="41" r="6.5" fill="#1e1b4b"/>
      {/* 눈 반짝임 */}
      <circle cx={leftShineX}  cy="37.5" r="2.5" fill="white"/>
      <circle cx={rightShineX} cy="37.5" r="2.5" fill="white"/>

      {/* ── 볼 홍조 ── */}
      <ellipse cx="30" cy="53" rx="9" ry="5.5" fill="#f9a8d4" opacity="0.7"/>
      <ellipse cx="90" cy="53" rx="9" ry="5.5" fill="#f9a8d4" opacity="0.7"/>

      {/* ── 입 ── */}
      <path d={mouth} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── 기분 별 추가 요소 ── */}
      {mood === 'happy' && (
        <>
          {/* 반짝이 별 */}
          <path d="M 10,22 L 14,26 M 10,26 L 14,22" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 106,16 L 109,19 M 106,19 L 109,16" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M 14,70 L 17,73 M 14,73 L 17,70" stroke="#f9a8d4" strokeWidth="1.6" strokeLinecap="round"/>
        </>
      )}
      {mood === 'worried' && (
        /* 땀방울 */
        <path
          d="M 97,18 C 97,18 100,26 97,31 C 95.5,34 93,35 92,34 C 90,33 90,30 91.5,27 Z"
          fill="#bae6fd"
        />
      )}
    </svg>
  );
}
