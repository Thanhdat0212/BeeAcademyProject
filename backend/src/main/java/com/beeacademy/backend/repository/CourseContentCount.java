package com.beeacademy.backend.repository;

import java.util.UUID;

public interface CourseContentCount {
    UUID getCourseId();
    long getItemCount();
}
