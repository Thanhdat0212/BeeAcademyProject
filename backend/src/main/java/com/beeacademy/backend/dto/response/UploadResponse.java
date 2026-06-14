package com.beeacademy.backend.dto.response;

/** Kết quả upload file lên Supabase Storage. */
public record UploadResponse(
        String storagePath,   // path trong bucket (dùng để generate signed URL sau này)
        String publicUrl,     // null nếu private bucket
        String fileType,
        Long fileSizeBytes
) {}
