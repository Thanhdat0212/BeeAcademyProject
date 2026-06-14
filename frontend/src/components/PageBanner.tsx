// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: PageBanner
//
// Banner dùng chung cho các trang con của student dashboard.
// Nằm ngay dưới DashboardHeader, trước <main>.
// Props:
//   title    — tiêu đề hiển thị bên trái, chữ trắng
//   subtitle — (optional) mô tả nhỏ bên dưới tiêu đề
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'motion/react';

interface PageBannerProps {
  title: string;
  subtitle?: string;
}

export default function PageBanner({ title, subtitle }: PageBannerProps) {
  return (
    <div
      className="relative h-40 w-full overflow-hidden flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #1e0845 0%, #4c1d95 55%, #7c3aed 100%)' }}
    >
      {/* Decorative blobs — background depth effect */}
      <div className="absolute -top-14 -right-14 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute top-3 right-[38%] w-28 h-28 rounded-full bg-white/[0.04] pointer-events-none" />

      {/* Content: max-w căn chỉnh với layout trang */}
      <div className="relative z-10 flex items-center justify-between h-full max-w-[1600px] mx-auto px-4 md:px-10">

        {/* Phần trái: Tiêu đề + Subtitle */}
        <motion.div
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-[2.6rem] font-extrabold text-white leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/65 mt-2 text-sm md:text-base font-medium">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Phần phải: Hình minh họa sách/học tập — ẩn trên mobile */}
        <motion.div
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
          className="hidden sm:block flex-shrink-0"
          aria-hidden="true"
        >
          <BooksIllustration />
        </motion.div>
      </div>
    </div>
  );
}

// ─── Hình minh họa sách + mũ tốt nghiệp + sparkles ──────────────────────────
// Thuần SVG, không cần external image.
// Tất cả màu đều là white với opacity thấp để hòa với nền gradient.
function BooksIllustration() {
  return (
    <svg
      width="190"
      height="128"
      viewBox="0 0 190 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vòng tròn nền glow */}
      <circle cx="125" cy="64" r="55" fill="rgba(255,255,255,0.06)" />
      <circle cx="125" cy="64" r="38" fill="rgba(255,255,255,0.06)" />

      {/* Sparkle dots */}
      <circle cx="176" cy="18" r="3.5" fill="rgba(255,255,255,0.72)" />
      <circle cx="164" cy="8"  r="2"   fill="rgba(255,255,255,0.5)"  />
      <circle cx="180" cy="98" r="2.5" fill="rgba(255,255,255,0.42)" />
      <circle cx="18"  cy="44" r="2"   fill="rgba(255,255,255,0.38)" />

      {/* Ngôi sao trái */}
      <path
        d="M28 18L30.2 25H38L31.9 29.2L34.1 36L28 31.8L21.9 36L24.1 29.2L18 25H25.8Z"
        fill="rgba(255,255,255,0.42)"
      />

      {/* Sách 1 — phía sau, nghiêng trái */}
      <g transform="rotate(-9, 68, 68)">
        <rect x="46" y="40" width="44" height="56" rx="3" fill="rgba(255,255,255,0.14)" />
        <rect x="48" y="42" width="5"  height="52" rx="2" fill="rgba(255,255,255,0.20)" />
      </g>

      {/* Sách 2 — giữa, nghiêng phải nhẹ */}
      <g transform="rotate(6, 86, 68)">
        <rect x="65" y="35" width="42" height="60" rx="3" fill="rgba(255,255,255,0.19)" />
        <rect x="67" y="37" width="5"  height="56" rx="2" fill="rgba(255,255,255,0.27)" />
      </g>

      {/* Sách 3 — phía trước, thẳng đứng (nổi bật nhất) */}
      <rect x="84" y="28" width="44" height="70" rx="4" fill="rgba(255,255,255,0.28)" />
      <rect x="86" y="30" width="6"  height="66" rx="3" fill="rgba(255,255,255,0.38)" />
      {/* Các dòng chữ giả trên sách */}
      <rect x="98" y="48" width="22" height="2.5" rx="1.25" fill="rgba(255,255,255,0.35)" />
      <rect x="98" y="55" width="16" height="2"   rx="1"    fill="rgba(255,255,255,0.28)" />
      <rect x="98" y="62" width="20" height="2"   rx="1"    fill="rgba(255,255,255,0.24)" />
      <rect x="98" y="69" width="13" height="2"   rx="1"    fill="rgba(255,255,255,0.18)" />

      {/* Mũ tốt nghiệp */}
      <ellipse cx="108" cy="22" rx="23" ry="9" fill="rgba(255,255,255,0.38)" />
      <rect    x="96"  cy="12" width="24" height="13" rx="2" fill="rgba(255,255,255,0.32)" />
      <circle  cx="108" cy="12" r="5" fill="rgba(255,255,255,0.44)" />
      {/* Tua mũ */}
      <line
        x1="131" y1="22" x2="137" y2="37"
        stroke="rgba(255,255,255,0.52)" strokeWidth="2" strokeLinecap="round"
      />
      <circle cx="137" cy="39" r="3" fill="rgba(255,255,255,0.44)" />

      {/* Ngôi sao phải */}
      <path
        d="M166 56L167.4 60.5H172L168.3 63.2L169.7 68L166 65.3L162.3 68L163.7 63.2L160 60.5H164.6Z"
        fill="rgba(255,255,255,0.33)"
      />

      {/* Bút chì nhỏ góc dưới phải */}
      <g transform="rotate(22, 160, 82)">
        <rect x="154" y="68" width="7" height="30" rx="2" fill="rgba(255,255,255,0.28)" />
        <rect x="155" y="68" width="2" height="30" rx="1" fill="rgba(255,255,255,0.18)" />
        <path d="M154 98 L157.5 106 L161 98 Z"    fill="rgba(255,255,255,0.34)" />
        <rect x="154" y="66" width="7" height="4"  rx="1" fill="rgba(255,255,255,0.20)" />
      </g>
    </svg>
  );
}
