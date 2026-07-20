import { useCallback, useEffect, useState } from 'react';
import type { CourseDiscussionThread } from '../../../../api/courseDiscussionService';
import { listCourseDiscussionThreads } from '../../../../api/courseDiscussionService';
import { listCoursePublicQaThreads, type QaThread, type QaVisibility } from '../../../../api/qaService';
import { notify } from '../../../../lib/toast';

type LearningTab = 'overview' | 'qa' | 'notes' | 'assignments' | 'reviews';

interface CourseDiscussionOptions {
  courseId: string;
  isEnrolled: boolean;
  userRole?: string;
  activeTab: LearningTab;
}

export function useCourseDiscussion({
  courseId,
  isEnrolled,
  userRole,
  activeTab,
}: CourseDiscussionOptions) {
  const [qaInput, setQaInput] = useState('');
  const [qaImageFile, setQaImageFile] = useState<File | null>(null);
  const [teacherQuestionTitle, setTeacherQuestionTitle] = useState('');
  const [teacherQuestionContent, setTeacherQuestionContent] = useState('');
  const [teacherQuestionVisibility, setTeacherQuestionVisibility] = useState<QaVisibility>('public');
  const [teacherQuestionImageFile, setTeacherQuestionImageFile] = useState<File | null>(null);
  const [publicQaThreads, setPublicQaThreads] = useState<QaThread[]>([]);
  const [loadingPublicQa, setLoadingPublicQa] = useState(false);
  const [sendingTeacherQuestion, setSendingTeacherQuestion] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [discussionThreads, setDiscussionThreads] = useState<CourseDiscussionThread[]>([]);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [postingReplyId, setPostingReplyId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState('');
  const [savingDiscussionId, setSavingDiscussionId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'qa') return;

    let cancelled = false;
    setLoadingDiscussion(true);
    listCourseDiscussionThreads(courseId)
      .then((items) => {
        if (!cancelled) setDiscussionThreads(items);
      })
      .catch((error) => {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : 'Không tải được thảo luận');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscussion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, courseId]);

  useEffect(() => {
    if (activeTab !== 'qa' || !isEnrolled || userRole !== 'student') return;

    let cancelled = false;
    setLoadingPublicQa(true);
    setPublicQaThreads([]);
    listCoursePublicQaThreads(courseId)
      .then((items) => {
        if (!cancelled) setPublicQaThreads(items);
      })
      .catch((error) => {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : 'Không tải được câu hỏi công khai');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPublicQa(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, courseId, isEnrolled, userRole]);

  const upsertDiscussionThread = useCallback((thread: CourseDiscussionThread) => {
    setDiscussionThreads((previous) => {
      const exists = previous.some((item) => item.id === thread.id);
      const next = exists
        ? previous.map((item) => item.id === thread.id ? thread : item)
        : [thread, ...previous];
      return next.sort((left, right) =>
        new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime()
      );
    });
  }, []);

  return {
    qaInput, setQaInput,
    qaImageFile, setQaImageFile,
    teacherQuestionTitle, setTeacherQuestionTitle,
    teacherQuestionContent, setTeacherQuestionContent,
    teacherQuestionVisibility, setTeacherQuestionVisibility,
    teacherQuestionImageFile, setTeacherQuestionImageFile,
    publicQaThreads, setPublicQaThreads,
    loadingPublicQa,
    sendingTeacherQuestion, setSendingTeacherQuestion,
    replyInputs, setReplyInputs,
    discussionThreads, setDiscussionThreads,
    loadingDiscussion,
    postingQuestion, setPostingQuestion,
    postingReplyId, setPostingReplyId,
    editingQuestionId, setEditingQuestionId,
    editingQuestionText, setEditingQuestionText,
    editingReplyId, setEditingReplyId,
    editingReplyText, setEditingReplyText,
    savingDiscussionId, setSavingDiscussionId,
    upsertDiscussionThread,
  };
}
