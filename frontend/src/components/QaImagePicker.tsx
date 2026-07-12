import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { notify } from '../lib/toast';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface QaImagePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function QaImagePicker({ file, onChange, disabled = false }: QaImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      notify.error('Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP');
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      notify.error('Ảnh đính kèm tối đa 5 MB');
      return;
    }
    onChange(selected);
  }

  return (
    <div className="mt-2">
      {file && previewUrl ? (
        <div className="relative inline-block max-w-full rounded-xl overflow-hidden border border-outline-variant/50 bg-surface-container">
          <img src={previewUrl} alt={file.name} className="block max-h-40 max-w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            title="Bỏ ảnh"
            className="absolute top-2 right-2 p-1 rounded-full bg-black/65 text-white hover:bg-black/80 disabled:opacity-60"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="px-3 py-1.5 text-xs text-on-surface-variant truncate max-w-sm">{file.name}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg disabled:opacity-60 transition-colors"
        >
          <ImagePlus className="w-4 h-4" />
          Thêm ảnh
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={event => {
          selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {!file && <span className="ml-2 text-xs text-on-surface-variant">PNG, JPG, WEBP · tối đa 5 MB</span>}
    </div>
  );
}
