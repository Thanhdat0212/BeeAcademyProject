package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeacherAccessService {

    private final ProfileRepository profileRepository;

    @Transactional(readOnly = true)
    public Profile requireApprovedTeacher(AuthenticatedUser me) {
        Profile teacher = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        requireApprovedTeacher(me, teacher);
        return teacher;
    }

    public void requireApprovedTeacher(AuthenticatedUser me, Profile teacher) {
        if (!UserRole.TEACHER.toDbValue().equalsIgnoreCase(me.role())
                || teacher == null
                || !teacher.isApprovedTeacher()) {
            throw new BusinessException(
                    "TEACHER_NOT_APPROVED",
                    "Giáo viên chưa được phê duyệt nên chưa thể sử dụng chức năng này.",
                    HttpStatus.FORBIDDEN);
        }
    }
}
