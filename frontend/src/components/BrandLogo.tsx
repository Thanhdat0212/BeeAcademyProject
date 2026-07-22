// Logo thương hiệu: ong siêu nhân Bee Academy, thay cho ô chữ "B" cũ.
// Ảnh nằm ở frontend/public nên dùng đường dẫn tuyệt đối — cùng file với favicon,
// không cần import qua bundler.
const LOGO_SRC = '/logo-bee.png';

// Mascot cao hơn rộng (360×512) nên với object-contain thì chiều cao quyết định
// kích thước hiển thị. Mỗi mức nhỉnh hơn ô "B" cũ một nấc để giữ nguyên độ nặng
// thị giác trong header/sidebar.
const SIZE_CLASS = {
  sm: 'w-11 h-11',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
} as const;

interface BrandLogoProps {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

export default function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Bee Academy"
      draggable={false}
      className={`${SIZE_CLASS[size]} object-contain flex-shrink-0 select-none ${className}`}
    />
  );
}
