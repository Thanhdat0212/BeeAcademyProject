/*
 * Seed chapter/lesson skeleton for course "Tieng Anh 6 Global Success"
 * owned by teacher "Le Dai Thanh TC".
 *
 * Run from backend:
 *   node db/seeds/seed_english6_global_success_ledaithanh_tc.cjs
 *
 * Idempotent:
 * - Chapters are upserted by UNIQUE(course_id, position).
 * - Lessons are upserted by UNIQUE(chapter_id, position).
 * - Existing video/document/resource fields are not overwritten.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const COURSE_ID = "1eb3bd29-e1df-4a1e-b2e6-c1b3b56eca98";
const COURSE_SLUG = "tieng-anh-6-global-success";
const TEACHER_ID = "f56d5e24-d18b-490d-820f-f20d9ee1b680";
const UUID_V5_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const NS = uuidv5("beeacademy.seed.english6.global-success.ledaithanh-tc", UUID_V5_DNS);

const UNITS = [
  [1, "My new school", ["6, 7", "8", "9, 10", "11", "12", "13", "14", "15"]],
  [2, "My house", ["16, 17", "17, 18", "18, 19", "20, 21", "22", "23", "24", "25"]],
  [3, "My friends", ["26, 27", "28, 29", "29, 30", "31", "32", "33", "34", "35"]],
  [4, "My neighbourhood", ["38, 39", "40", "41, 42", "43", "44", "45", "46", "47"]],
  [5, "Natural wonders of Viet Nam", ["48, 49", "50, 51", "51, 52", "53", "54", "55", "56", "57"], "Natural Wonders of the world"],
  [6, "Our Tet holiday", ["58, 59", "60", "61, 62", "63", "64, 65", "65", "66", "67"], "Our tet holiday"],
  [7, "Television", ["6, 7", "8", "9, 10", "11", "12, 13", "13", "14", "15"]],
  [8, "Sports and games", ["16, 17", "18", "19, 20", "21", "22", "23", "24", "25"]],
  [9, "Cities of the world", ["26, 27", "28", "29, 30", "31", "32", "33", "34", "35"]],
  [10, "Our houses in the future", ["38, 39", "40", "41, 42", "43", "44", "45", "46", "47"]],
  [11, "Our greener world", ["48, 49", "50, 51", "51, 52", "53", "54", "55", "56", "57"]],
  [12, "Robots", ["58, 59", "60", "61, 62", "63", "64", "65", "66", "67"]],
];

const CHAPTERS = [
  ...UNITS.slice(0, 9).map(toUnitChapter),
  {
    title: "Review 3 (Unit 7-8-9)",
    description: "Khung b\u00e0i \u00f4n t\u1eadp Review 3 cho Unit 7, Unit 8 v\u00e0 Unit 9.",
    lessons: [
      ["Review 3 Language (trang 36)", "Khung b\u00e0i h\u1ecdc Review 3 Language."],
      ["Review 3 Skills (trang 36, 37)", "Khung b\u00e0i h\u1ecdc Review 3 Skills."],
    ],
  },
  ...UNITS.slice(9).map(toUnitChapter),
];

function toUnitChapter([number, topic, pages, grammarTopic = topic]) {
  const sectionNames = [
    "Getting Started",
    "A Closer Look 1",
    "A Closer Look 2",
    "Communication",
    "Skills 1",
    "Skills 2",
    "Looking Back",
    "Project",
  ];
  return {
    title: `Unit ${number}: ${topic}`,
    description: `Khung ch\u01b0\u01a1ng Unit ${number}: ${topic}.`,
    lessons: [
      [`T\u1eeb v\u1ef1ng Unit ${number} l\u1edbp 6`, `Khung b\u00e0i h\u1ecdc t\u1eeb v\u1ef1ng Unit ${number}.`],
      [`Ng\u1eef ph\u00e1p Unit ${number}: ${grammarTopic}`, `Khung b\u00e0i h\u1ecdc ng\u1eef ph\u00e1p Unit ${number}.`],
      ...sectionNames.map((name, index) => [
        `Unit ${number} ${name} (trang ${pages[index]})`,
        `Khung b\u00e0i h\u1ecdc ${name}.`,
      ]),
    ],
  };
}

function uuidv5(name, namespace) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, Buffer.from(name)])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function id(key) {
  return uuidv5(key, NS);
}

function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  const env = {};
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const client = new Client({
    host: env.SUPABASE_DB_HOST,
    port: Number(env.SUPABASE_DB_PORT),
    database: env.SUPABASE_DB_NAME,
    user: env.SUPABASE_DB_USER,
    password: env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  try {
    await client.query("begin");

    const course = await client.query(
      `select id, slug, title, teacher_id
       from public.courses
       where id = $1 and slug = $2 and teacher_id = $3
       for update`,
      [COURSE_ID, COURSE_SLUG, TEACHER_ID],
    );
    if (course.rowCount !== 1) {
      throw new Error("Target course was not found for Le Dai Thanh TC.");
    }

    for (const [chapterIndex, chapter] of CHAPTERS.entries()) {
      const chapterPosition = chapterIndex + 1;
      const chapterId = id(`chapter.${chapterPosition}`);
      const chapterResult = await client.query(
        `insert into public.chapters (id, course_id, title, description, position)
         values ($1, $2, $3, $4, $5)
         on conflict (course_id, position) do update set
           title = excluded.title,
           description = excluded.description
         returning id`,
        [chapterId, COURSE_ID, chapter.title, chapter.description, chapterPosition],
      );

      for (const [lessonIndex, lesson] of chapter.lessons.entries()) {
        const lessonPosition = lessonIndex + 1;
        const lessonId = id(`chapter.${chapterPosition}.lesson.${lessonPosition}`);
        await client.query(
          `insert into public.lessons
             (id, chapter_id, title, description, position, duration_sec, is_free, resources,
              video_url, video_embed_url, video_storage_path)
           values ($1, $2, $3, $4, $5, 0, false, '[]'::jsonb, null, null, null)
           on conflict (chapter_id, position) do update set
             title = excluded.title,
             description = excluded.description`,
          [lessonId, chapterResult.rows[0].id, lesson[0], lesson[1], lessonPosition],
        );
      }
    }

    await client.query(
      `update public.courses c set
         total_chapters = sub.total_chapters,
         total_lessons = sub.total_lessons,
         total_duration_sec = sub.total_duration_sec,
         updated_at = now()
       from (
         select ch.course_id,
                count(distinct ch.id)::int as total_chapters,
                count(l.id)::int as total_lessons,
                coalesce(sum(l.duration_sec), 0)::int as total_duration_sec
         from public.chapters ch
         left join public.lessons l on l.chapter_id = ch.id
         where ch.course_id = $1
         group by ch.course_id
       ) sub
       where c.id = sub.course_id`,
      [COURSE_ID],
    );

    await client.query("commit");

    const verify = await client.query(
      `select c.title, c.status::text as status, c.total_chapters, c.total_lessons,
              count(distinct ch.id)::int as actual_chapters,
              count(l.id)::int as actual_lessons
       from public.courses c
       left join public.chapters ch on ch.course_id = c.id
       left join public.lessons l on l.chapter_id = ch.id
       where c.id = $1
       group by c.id`,
      [COURSE_ID],
    );
    const row = verify.rows[0];
    console.log("Seeded course skeleton:");
    console.log(`  Course         : ${row.title}`);
    console.log(`  Status         : ${row.status}`);
    console.log(`  Chapters       : ${row.total_chapters} (actual ${row.actual_chapters})`);
    console.log(`  Lessons        : ${row.total_lessons} (actual ${row.actual_lessons})`);
    console.log("  Video/docs     : empty for teacher upload later");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
