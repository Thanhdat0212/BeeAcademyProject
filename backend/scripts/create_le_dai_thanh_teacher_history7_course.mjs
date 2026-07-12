import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const teacherName = process.argv[2] ?? "Lê Đại Thành TC";

function readDotEnv(filePath) {
  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function toArray(value) {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function buildPath(table, params) {
  const query = new URLSearchParams(params);
  return `${table}?${query.toString()}`;
}

async function request({ supabaseUrl, serviceRoleKey, method, endpoint, body, extraHeaders = {} }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function getSingle(context, endpoint, notFoundMessage) {
  const rows = toArray(await request({ ...context, method: "GET", endpoint }));
  if (rows.length === 0) {
    throw new Error(notFoundMessage);
  }

  return rows[0];
}

const chapters = [
  {
    position: 1,
    title: "Chương 1: Tây Âu từ thế kỉ V đến nửa đầu thế kỉ XVI",
    description:
      "Khái quát sự hình thành xã hội phong kiến Tây Âu, các cuộc phát kiến địa lí và những biến đổi lớn về văn hóa, tôn giáo.",
    lessons: [
      {
        position: 1,
        title: "Bài 1: Quá trình hình thành và phát triển của chế độ phong kiến Tây Âu",
        description: "Tìm hiểu sự hình thành xã hội phong kiến Tây Âu và các đặc điểm cơ bản của chế độ này.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 2: Các cuộc phát kiến địa lí và sự hình thành quan hệ sản xuất tư bản chủ nghĩa ở Tây Âu",
        description: "Phân tích nguyên nhân, diễn biến các cuộc phát kiến địa lí và tác động đến sự hình thành chủ nghĩa tư bản.",
        is_free: false,
      },
      {
        position: 3,
        title: "Bài 3: Phong trào văn hóa Phục hưng và cải cách tôn giáo",
        description: "Khám phá những chuyển biến tư tưởng, văn hóa và tôn giáo ở Tây Âu thời kì cận đại sớm.",
        is_free: false,
      },
    ],
  },
  {
    position: 2,
    title: "Chương 2: Trung Quốc và Ấn Độ thời trung đại",
    description: "Tập trung vào những nét chính của lịch sử Trung Quốc và Ấn Độ trong thời kì trung đại.",
    lessons: [
      {
        position: 1,
        title: "Bài 4: Trung Quốc từ thế kỉ VII đến giữa thế kỉ XIX",
        description: "Tìm hiểu sự phát triển của Trung Quốc dưới các triều đại lớn từ thế kỉ VII đến giữa thế kỉ XIX.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 5: Ấn Độ từ thế kỉ IV đến giữa thế kỉ XIX",
        description: "Khái quát tiến trình lịch sử Ấn Độ và những thành tựu nổi bật trong giai đoạn trung đại.",
        is_free: false,
      },
    ],
  },
  {
    position: 3,
    title: "Chương 3: Đông Nam Á từ nửa sau thế kỉ X đến nửa đầu thế kỉ XVI",
    description:
      "Khái quát sự phát triển của các quốc gia phong kiến Đông Nam Á và hai vương quốc tiêu biểu là Lào, Cam-pu-chia.",
    lessons: [
      {
        position: 1,
        title: "Bài 6: Các vương quốc phong kiến Đông Nam Á từ nửa sau thế kỉ X đến nửa đầu thế kỉ XVI",
        description: "Tìm hiểu sự phát triển của các quốc gia phong kiến Đông Nam Á trong giai đoạn cực thịnh.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 7: Vương quốc Lào",
        description: "Khám phá lịch sử hình thành, phát triển và bản sắc của Vương quốc Lào thời trung đại.",
        is_free: false,
      },
      {
        position: 3,
        title: "Bài 8: Vương quốc Cam-pu-chia",
        description: "Tìm hiểu tiến trình lịch sử và thành tựu tiêu biểu của Vương quốc Cam-pu-chia.",
        is_free: false,
      },
    ],
  },
  {
    position: 4,
    title: "Chương 4: Đất nước dưới thời các vương triều Ngô - Đinh - Tiền Lê (939 - 1009)",
    description: "Tìm hiểu quá trình xây dựng nền độc lập tự chủ đầu tiên của dân tộc sau chiến thắng Bạch Đằng.",
    lessons: [
      {
        position: 1,
        title: "Bài 9: Đất nước buổi đầu độc lập (939 - 967)",
        description: "Khái quát tình hình đất nước dưới thời Ngô và những bước đầu của nền độc lập.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 10: Đại Cồ Việt thời Đinh và Tiền Lê (968 - 1009)",
        description: "Tìm hiểu sự thành lập nước Đại Cồ Việt và công cuộc xây dựng, bảo vệ đất nước.",
        is_free: false,
      },
    ],
  },
  {
    position: 5,
    title: "Chương 5: Đại Việt thời Lý - Trần - Hồ (1009 - 1407)",
    description:
      "Khái quát quá trình xây dựng, phát triển đất nước và những cuộc kháng chiến lớn dưới thời Lý, Trần, Hồ.",
    lessons: [
      {
        position: 1,
        title: "Bài 11: Nhà Lý xây dựng và phát triển đất nước (1009 - 1225)",
        description: "Tìm hiểu công cuộc xây dựng chính quyền, kinh tế và văn hóa dưới thời Lý.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 12: Cuộc kháng chiến chống quân xâm lược Tống (1075 - 1077)",
        description: "Phân tích nguyên nhân, diễn biến và ý nghĩa của cuộc kháng chiến chống Tống.",
        is_free: false,
      },
      {
        position: 3,
        title: "Bài 13: Đại Việt thời Trần (1226 - 1400)",
        description: "Khái quát những nét chính về chính trị, kinh tế, xã hội và văn hóa thời Trần.",
        is_free: false,
      },
      {
        position: 4,
        title: "Bài 14: Ba lần kháng chiến chống quân xâm lược Mông - Nguyên",
        description: "Tìm hiểu diễn biến, nghệ thuật quân sự và ý nghĩa lịch sử của các cuộc kháng chiến Mông - Nguyên.",
        is_free: false,
      },
      {
        position: 5,
        title: "Bài 15: Nước Đại Ngu thời Hồ (1400 - 1407)",
        description: "Khái quát cải cách thời Hồ và bối cảnh lịch sử của nước Đại Ngu.",
        is_free: false,
      },
    ],
  },
  {
    position: 6,
    title: "Chương 6: Khởi nghĩa Lam Sơn và Đại Việt thời Lê sơ (1418 - 1527)",
    description: "Tìm hiểu cuộc khởi nghĩa Lam Sơn và sự phát triển của Đại Việt dưới thời Lê sơ.",
    lessons: [
      {
        position: 1,
        title: "Bài 16: Khởi nghĩa Lam Sơn (1418 - 1427)",
        description: "Khái quát nguyên nhân, diễn biến và ý nghĩa lịch sử của khởi nghĩa Lam Sơn.",
        is_free: true,
      },
      {
        position: 2,
        title: "Bài 17: Đại Việt thời Lê sơ (1428 - 1527)",
        description: "Tìm hiểu bộ máy nhà nước, kinh tế, văn hóa và xã hội dưới thời Lê sơ.",
        is_free: false,
      },
    ],
  },
  {
    position: 7,
    title: "Chương 7: Vùng đất phía Nam Việt Nam từ đầu thế kỉ X đến đầu thế kỉ XVI",
    description: "Khái quát lịch sử Vương quốc Chăm-pa và vùng đất Nam Bộ trong tiến trình lịch sử Việt Nam.",
    lessons: [
      {
        position: 1,
        title: "Bài 18: Vương quốc Chăm-pa và vùng đất Nam Bộ từ đầu thế kỉ X đến thế kỉ XVI",
        description: "Tìm hiểu lịch sử Chăm-pa và quá trình hình thành, phát triển vùng đất Nam Bộ.",
        is_free: true,
      },
    ],
  },
];

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const envPath = path.resolve(currentDir, "..", ".env");
  const env = readDotEnv(envPath);

  const context = {
    supabaseUrl: env.SUPABASE_URL.replace(/\/+$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const courseSlug = "lich-su-7-ket-noi-tri-thuc";
  const coursePayload = {
    slug: courseSlug,
    title: "Lịch sử 7 - Kết nối tri thức",
    description:
      "Khóa học bám sát chương trình Lịch sử 7 bộ Kết nối tri thức, tập trung vào lịch sử thế giới thời trung đại và lịch sử Việt Nam từ thế kỉ X đến đầu thế kỉ XVI. Nội dung được chia theo đúng 7 chương và 18 bài học trong khung chương trình.",
    objective:
      "Nắm chắc mạch kiến thức Lịch sử 7 theo bộ Kết nối tri thức, hiểu tiến trình lịch sử thế giới và Việt Nam, đồng thời ôn tập thuận tiện theo từng bài trong sách.",
    audience:
      "Học sinh lớp 7 đang học bộ Kết nối tri thức và cần một khóa học bám sát khung bài học trên lớp.",
    thumbnail_url: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80",
    intro_video_url: null,
    grades: [7],
    price_vnd: 399000,
    sale_price_vnd: 299000,
    status: "published",
    is_featured: true,
    published_at: new Date().toISOString(),
  };

  const teacher = await getSingle(
    context,
    buildPath("profiles", {
      select: "id,full_name,role",
      role: "eq.teacher",
      full_name: `eq.${teacherName}`,
    }),
    `Khong tim thay tai khoan giao vien "${teacherName}".`,
  );

  const category = await getSingle(
    context,
    buildPath("categories", {
      select: "id,slug,name",
      slug: "eq.lich-su-dia-ly",
    }),
    "Khong tim thay category lich-su-dia-ly.",
  );

  coursePayload.teacher_id = teacher.id;
  coursePayload.category_id = category.id;

  const existingCourses = toArray(
    await request({
      ...context,
      method: "GET",
      endpoint: buildPath("courses", {
        select: "id,slug,title",
        teacher_id: `eq.${teacher.id}`,
        slug: `eq.${courseSlug}`,
      }),
    }),
  );

  let courseId;
  if (existingCourses.length > 0) {
    courseId = existingCourses[0].id;
    await request({
      ...context,
      method: "PATCH",
      endpoint: buildPath("courses", { id: `eq.${courseId}` }),
      body: coursePayload,
      extraHeaders: { Prefer: "return=representation" },
    });
  } else {
    const createdCourses = toArray(
      await request({
        ...context,
        method: "POST",
        endpoint: "courses",
        body: coursePayload,
        extraHeaders: { Prefer: "return=representation" },
      }),
    );
    courseId = createdCourses[0].id;
  }

  let totalLessons = 0;

  for (const chapter of chapters) {
    const chapterPayload = {
      course_id: courseId,
      title: chapter.title,
      description: chapter.description,
      position: chapter.position,
    };

    const existingChapters = toArray(
      await request({
        ...context,
        method: "GET",
        endpoint: buildPath("chapters", {
          select: "id,position",
          course_id: `eq.${courseId}`,
          position: `eq.${chapter.position}`,
        }),
      }),
    );

    let chapterId;
    if (existingChapters.length > 0) {
      chapterId = existingChapters[0].id;
      await request({
        ...context,
        method: "PATCH",
        endpoint: buildPath("chapters", { id: `eq.${chapterId}` }),
        body: chapterPayload,
        extraHeaders: { Prefer: "return=representation" },
      });
    } else {
      const createdChapters = toArray(
        await request({
          ...context,
          method: "POST",
          endpoint: "chapters",
          body: chapterPayload,
          extraHeaders: { Prefer: "return=representation" },
        }),
      );
      chapterId = createdChapters[0].id;
    }

    for (const lesson of chapter.lessons) {
      totalLessons += 1;

      const lessonPayload = {
        chapter_id: chapterId,
        title: lesson.title,
        description: lesson.description,
        duration_sec: 0,
        position: lesson.position,
        is_free: lesson.is_free,
      };

      const existingLessons = toArray(
        await request({
          ...context,
          method: "GET",
          endpoint: buildPath("lessons", {
            select: "id,position",
            chapter_id: `eq.${chapterId}`,
            position: `eq.${lesson.position}`,
          }),
        }),
      );

      if (existingLessons.length > 0) {
        await request({
          ...context,
          method: "PATCH",
          endpoint: buildPath("lessons", { id: `eq.${existingLessons[0].id}` }),
          body: lessonPayload,
          extraHeaders: { Prefer: "return=representation" },
        });
      } else {
        await request({
          ...context,
          method: "POST",
          endpoint: "lessons",
          body: lessonPayload,
          extraHeaders: { Prefer: "return=representation" },
        });
      }
    }
  }

  await request({
    ...context,
    method: "PATCH",
    endpoint: buildPath("courses", { id: `eq.${courseId}` }),
    body: {
      total_chapters: chapters.length,
      total_lessons: totalLessons,
      total_duration_sec: 0,
    },
    extraHeaders: { Prefer: "return=representation" },
  });

  const course = await getSingle(
    context,
    buildPath("courses", {
      select: "id,title,status,total_chapters,total_lessons,teacher_id",
      teacher_id: `eq.${teacher.id}`,
      slug: `eq.${courseSlug}`,
    }),
    "Khong doc duoc khoa hoc sau khi tao.",
  );

  const chapterRows = toArray(
    await request({
      ...context,
      method: "GET",
      endpoint: buildPath("chapters", {
        select: "id,position,title",
        course_id: `eq.${courseId}`,
        order: "position.asc",
      }),
    }),
  );

  let lessonRows = [];
  if (chapterRows.length > 0) {
    lessonRows = toArray(
      await request({
        ...context,
        method: "GET",
        endpoint: buildPath("lessons", {
          select: "id,chapter_id,position,title",
          chapter_id: `in.(${chapterRows.map((item) => item.id).join(",")})`,
          order: "chapter_id.asc,position.asc",
        }),
      }),
    );
  }

  console.log("KHOA HOC DA DUOC TAO/CAP NHAT");
  console.log(`Teacher     : ${teacher.full_name}`);
  console.log(`Course ID   : ${course.id}`);
  console.log(`Title       : ${course.title}`);
  console.log(`Status      : ${course.status}`);
  console.log(`Chapters    : ${chapterRows.length}`);
  console.log(`Lessons     : ${lessonRows.length}`);
  console.log(`Course slug : ${courseSlug}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
