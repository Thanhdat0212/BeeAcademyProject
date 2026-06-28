/**
 * Component dùng chung cho file đính kèm khiếu nại:
 *  - AttachmentPicker: chọn ảnh/PDF + preview trước khi gửi (validate số lượng/size/loại).
 *  - MessageAttachments: hiển thị file đã gửi (thumbnail ảnh / chip PDF), click mở signed URL.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, FileText, ImageIcon } from 'lucide-react';
import { notify } from '../../lib/toast';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  type ComplaintAttachment,
} from '../../api/complaintService';

const ACCEPT_SET = new Set(ATTACHMENT_ACCEPT.split(','));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Picker: chọn + preview file trước khi gửi ───────────────────────────────
export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(selected: FileList | null) {
    if (!selected) return;
    const incoming = Array.from(selected);
    const valid: File[] = [];
    for (const file of incoming) {
      if (!ACCEPT_SET.has(file.type)) {
        notify.error(`"${file.name}" không hợp lệ — chỉ nhận ảnh JPEG/PNG/WEBP hoặc PDF.`);
        continue;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        notify.error(`"${file.name}" vượt quá 5MB.`);
        continue;
      }
      valid.push(file);
    }
    const merged = [...files, ...valid].slice(0, ATTACHMENT_MAX_FILES);
    if (files.length + valid.length > ATTACHMENT_MAX_FILES) {
      notify.error(`Tối đa ${ATTACHMENT_MAX_FILES} file đính kèm.`);
    }
    onChange(merged);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        hidden
        onChange={e => handleSelect(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled || files.length >= ATTACHMENT_MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Paperclip className="w-3.5 h-3.5" />
        Đính kèm ảnh / PDF
        <span className="text-on-surface-variant/60">({files.length}/{ATTACHMENT_MAX_FILES})</span>
      </button>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <FilePreview key={`${file.name}-${i}`} file={file} onRemove={() => removeAt(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="relative group w-16 h-16 rounded-lg border border-outline-variant/40 bg-surface-container overflow-hidden flex items-center justify-center">
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center text-on-surface-variant px-1">
          <FileText className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">PDF</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500"
        aria-label={`Xoá ${file.name}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ── Hiển thị file đã gửi trong một tin nhắn ─────────────────────────────────
export function MessageAttachments({ attachments }: { attachments: ComplaintAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(att => {
        const isImage = att.contentType.startsWith('image/');
        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${att.fileName} · ${formatBytes(att.sizeBytes)}`}
            className="block"
          >
            {isImage ? (
              <img
                src={att.url}
                alt={att.fileName}
                className="w-24 h-24 object-cover rounded-lg border border-outline-variant/40 hover:opacity-90 transition-opacity"
              />
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors max-w-[200px]">
                {att.contentType === 'application/pdf'
                  ? <FileText className="w-4 h-4 flex-shrink-0 text-red-500" />
                  : <ImageIcon className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate">{att.fileName}</span>
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
