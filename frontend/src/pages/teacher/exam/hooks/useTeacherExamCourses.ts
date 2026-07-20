import { useEffect, useState } from 'react';
import * as examService from '../../../../api/examService';
import { getCourseDetail, listMyCourses } from '../../../../api/teacherCourseService';
import { notify } from '../../../../lib/toast';
import type { CourseInfo, Exam } from '../examTypes';
import { courseInfoFromDetail } from '../examUtils';

export function useTeacherExamCourses() {
  const [data, setData] = useState<CourseInfo[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCoursesAndExams() {
      setLoading(true);
      try {
        const page = await listMyCourses(0, 100);
        const courses = await Promise.all(
          page.items.map(async (course) => {
            const [detail, exams] = await Promise.all([
              getCourseDetail(course.id),
              examService.listCourseExams(course.id),
            ]);
            return courseInfoFromDetail(detail, exams);
          }),
        );

        if (cancelled) return;
        setData(courses);
        setSelectedCourseId((previous) => {
          if (previous && courses.some((course) => course.id === previous)) return previous;
          return courses[0]?.id ?? '';
        });
        setSelectedSlotIndex(null);
        setForm(null);
      } catch (error) {
        if (!cancelled) {
          setData([]);
          setSelectedCourseId('');
          notify.error(error instanceof Error
            ? error.message
            : 'Không tải được danh sách bài kiểm tra');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCoursesAndExams();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    data,
    setData,
    selectedCourseId,
    setSelectedCourseId,
    selectedSlotIndex,
    setSelectedSlotIndex,
    form,
    setForm,
    loading,
  };
}
