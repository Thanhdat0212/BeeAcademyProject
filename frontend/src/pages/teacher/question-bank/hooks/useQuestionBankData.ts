import { useCallback, useEffect, useState } from 'react';
import { listCategories } from '../../../../api/courseService';
import type { QuestionBankResponse } from '../../../../api/questionBankService';
import * as questionBankService from '../../../../api/questionBankService';
import type {
  Difficulty,
  QuestionResponse,
  QuestionStatus,
} from '../../../../api/questionService';
import * as questionService from '../../../../api/questionService';
import { listMyCourses, type TeacherCourseResponse } from '../../../../api/teacherCourseService';
import { notify } from '../../../../lib/toast';
import type { Category } from '../../../../types/api';

export const QUESTION_FETCH_LIMIT = 200;

interface QuestionBankFilters {
  difficulty: Difficulty | 'all';
  status: QuestionStatus | 'all';
  bankId: string;
  categoryId: string;
  grade: string;
  chapterId: string;
}

export function useQuestionBankData(filters: QuestionBankFilters) {
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [banks, setBanks] = useState<QuestionBankResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<TeacherCourseResponse[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCategories(),
      listMyCourses(0, 100).then((page) => page.items),
    ])
      .then(([nextCategories, nextCourses]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setCourses(nextCourses);
      })
      .catch(() => {
        if (!cancelled) notify.error('Không tải được danh sách môn học / khóa học');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);
    questionBankService.listQuestionBanks()
      .then((items) => {
        if (!cancelled) setBanks(items);
      })
      .catch(() => {
        if (!cancelled) notify.error('Không tải được danh sách ngân hàng câu hỏi');
      })
      .finally(() => {
        if (!cancelled) setLoadingBanks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bankRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingQuestions(true);

    const params: questionService.ListQuestionsParams = {
      page: 0,
      size: QUESTION_FETCH_LIMIT,
    };
    if (filters.difficulty !== 'all') params.difficulty = filters.difficulty;
    if (filters.status !== 'all') params.status = filters.status;
    if (filters.bankId) params.questionBankId = filters.bankId;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.grade) params.grade = Number(filters.grade);
    if (filters.chapterId) params.chapterId = filters.chapterId;

    questionService.listQuestions(params)
      .then((pageResult) => {
        if (cancelled) return;
        const filteredItems = pageResult.items.filter((question) => {
          if (filters.categoryId && question.categoryId !== filters.categoryId) return false;
          if (filters.grade && question.grade !== Number(filters.grade)) return false;
          if (filters.chapterId && question.chapterId !== filters.chapterId) return false;
          if (filters.difficulty !== 'all' && question.difficulty !== filters.difficulty) return false;
          if (filters.status !== 'all' && question.status !== filters.status) return false;
          if (filters.bankId && question.questionBankId !== filters.bankId) return false;
          return true;
        });
        setQuestions(filteredItems);
        setTotalItems(pageResult.totalItems);
      })
      .catch(() => {
        if (!cancelled) notify.error('Không tải được danh sách câu hỏi');
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    bankRefreshKey,
    filters.bankId,
    filters.categoryId,
    filters.chapterId,
    filters.difficulty,
    filters.grade,
    filters.status,
    refreshKey,
  ]);

  const reloadQuestions = useCallback(() => setRefreshKey((key) => key + 1), []);
  const reloadPageData = useCallback(() => {
    reloadQuestions();
    setBankRefreshKey((key) => key + 1);
  }, [reloadQuestions]);

  return {
    questions,
    banks,
    totalItems,
    categories,
    courses,
    loadingQuestions,
    loadingBanks,
    reloadQuestions,
    reloadPageData,
    refreshBanks: () => setBankRefreshKey((key) => key + 1),
  };
}
