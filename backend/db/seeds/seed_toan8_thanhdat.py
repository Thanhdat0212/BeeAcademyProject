"""
Seed một khóa học hoàn chỉnh cho giáo viên thanhdatvv05@gmail.com.

Tạo:
  - 1 khóa học "Toán 8: Nền Tảng Đại Số & Hình Học" (published, featured)
  - 6 chương, mỗi chương 3 bài học (bài đầu mỗi chương là video xem mẫu free)
  - Ngân hàng câu hỏi: 6 câu/chương (kèm 4 đáp án + giải thích)
  - Quiz cấu hình sẵn cho mỗi chương (manual — dùng đúng câu của chương đó)
  - 2 bài kiểm tra cuối kỳ (slot 0: chương 1-3, slot 1: chương 4-6)

Chạy: python backend/db/seeds/seed_toan8_thanhdat.py
Idempotent: UUID sinh xác định bằng uuid5 + ON CONFLICT DO UPDATE.
"""
import json
import uuid
import psycopg2
from psycopg2.extras import execute_values

TEACHER_ID = "ec8946f8-9349-474b-a5cb-d97c8dc720d3"   # thanhdatvv05@gmail.com
CATEGORY_TOAN = "059c4d87-a6b5-4cdd-b21e-f782bcfb1caa"  # toan-hoc
GRADE = 8

NS = uuid.uuid5(uuid.NAMESPACE_DNS, "beeacademy.seed.toan8.thanhdat")
def U(key: str) -> str:
    return str(uuid.uuid5(NS, key))

COURSE_ID = U("course")

# Video YouTube bài giảng Toán 8 có thật (đã verify tồn tại + cho phép nhúng qua oEmbed).
# Lưu dạng /embed/ vì frontend dùng trực tiếp URL làm src của <iframe>.
# Mỗi chương 3 video tương ứng 3 bài học.
def _yt(vid: str) -> str:
    return f"https://www.youtube.com/embed/{vid}"

LESSON_VIDEOS = [
    # Chương 1: Phép nhân và phép chia đa thức
    [_yt("GptNfPME7u8"), _yt("7nVlewVsLQY"), _yt("nTbmhARf2Ss")],
    # Chương 2: Phân thức đại số
    [_yt("pS91KqSppZQ"), _yt("sfXowmg886A"), _yt("acuEzjyTNO0")],
    # Chương 3: Phương trình bậc nhất một ẩn
    [_yt("_HVNoq3Z5Qo"), _yt("h5G2W0v9nkM"), _yt("UmjIR7yAiU4")],
    # Chương 4: Tứ giác
    [_yt("3ZgEafyNIDk"), _yt("WibXsle93H0"), _yt("XE6ZbI2nXc4")],
    # Chương 5: Đa giác — Diện tích đa giác
    [_yt("AxugQyCO0Rk"), _yt("05KksI21nUg"), _yt("moSvA8BMPkw")],
    # Chương 6: Tam giác đồng dạng
    [_yt("8Kf_eg922RU"), _yt("0qPA8YHuC1g"), _yt("3luPct0aCAg")],
]
INTRO_VIDEO = _yt("GptNfPME7u8")

# ---------------------------------------------------------------------------
# Nội dung: chương + bài học
# ---------------------------------------------------------------------------
CHAPTERS = [
    {
        "title": "Chương 1: Phép nhân và phép chia đa thức",
        "desc": "Nhân đơn thức với đa thức, hằng đẳng thức đáng nhớ và phép chia đa thức.",
        "lessons": [
            ("Bài 1: Nhân đơn thức với đa thức (Học thử)",
             "Quy tắc nhân và ví dụ minh họa.", True),
            ("Bài 2: Bảy hằng đẳng thức đáng nhớ",
             "Ghi nhớ và vận dụng 7 hằng đẳng thức.", False),
            ("Bài 3: Phân tích đa thức & phép chia",
             "Đặt nhân tử chung và chia đa thức cho đơn thức.", False),
        ],
    },
    {
        "title": "Chương 2: Phân thức đại số",
        "desc": "Điều kiện xác định, rút gọn và các phép tính với phân thức đại số.",
        "lessons": [
            ("Bài 1: Khái niệm phân thức & ĐKXĐ (Học thử)",
             "Phân thức đại số là gì và khi nào xác định.", True),
            ("Bài 2: Rút gọn phân thức",
             "Phân tích tử mẫu thành nhân tử rồi rút gọn.", False),
            ("Bài 3: Cộng, trừ, nhân, chia phân thức",
             "Quy đồng mẫu thức và thực hiện phép tính.", False),
        ],
    },
    {
        "title": "Chương 3: Phương trình bậc nhất một ẩn",
        "desc": "Giải phương trình bậc nhất, phương trình đưa về dạng ax + b = 0.",
        "lessons": [
            ("Bài 1: Mở đầu về phương trình (Học thử)",
             "Nghiệm của phương trình và phương trình tương đương.", True),
            ("Bài 2: Phương trình bậc nhất một ẩn",
             "Quy tắc chuyển vế, quy tắc nhân để giải.", False),
            ("Bài 3: Phương trình đưa về dạng ax + b = 0",
             "Khử mẫu, mở ngoặc và thu gọn.", False),
        ],
    },
    {
        "title": "Chương 4: Tứ giác",
        "desc": "Tứ giác, hình thang, hình bình hành, hình chữ nhật và tính chất.",
        "lessons": [
            ("Bài 1: Tứ giác & tổng các góc (Học thử)",
             "Định nghĩa tứ giác và định lý tổng bốn góc.", True),
            ("Bài 2: Hình thang — Hình bình hành",
             "Dấu hiệu nhận biết và tính chất.", False),
            ("Bài 3: Hình chữ nhật — Hình thoi — Hình vuông",
             "Quan hệ giữa các hình đặc biệt.", False),
        ],
    },
    {
        "title": "Chương 5: Đa giác — Diện tích đa giác",
        "desc": "Đa giác đều, công thức tính diện tích các hình cơ bản.",
        "lessons": [
            ("Bài 1: Đa giác — Đa giác đều (Học thử)",
             "Khái niệm đa giác và tổng các góc.", True),
            ("Bài 2: Diện tích hình chữ nhật, tam giác",
             "Công thức và bài tập áp dụng.", False),
            ("Bài 3: Diện tích hình thang, hình thoi",
             "Vận dụng công thức diện tích.", False),
        ],
    },
    {
        "title": "Chương 6: Tam giác đồng dạng",
        "desc": "Định lý Ta-lét, các trường hợp đồng dạng và ứng dụng thực tế.",
        "lessons": [
            ("Bài 1: Định lý Ta-lét (Học thử)",
             "Định lý Ta-lét trong tam giác.", True),
            ("Bài 2: Các trường hợp đồng dạng",
             "g-g, c-g-c, c-c-c của tam giác.", False),
            ("Bài 3: Ứng dụng tam giác đồng dạng",
             "Đo gián tiếp chiều cao, khoảng cách.", False),
        ],
    },
]

# ---------------------------------------------------------------------------
# Ngân hàng câu hỏi: mỗi chương 6 câu. Format:
#   (difficulty, content, explanation, [(choice, is_correct), ...])
# ---------------------------------------------------------------------------
QUESTIONS = {
    0: [
        ("easy", "Kết quả của phép tính $(x+3)(x-3)$ là?",
         "Áp dụng hằng đẳng thức $A^2-B^2=(A-B)(A+B)$.",
         [("$x^2-9$", True), ("$x^2+9$", False), ("$x^2-6x+9$", False), ("$x^2-3$", False)]),
        ("easy", "Khai triển $(x+2)^2$ ta được?",
         "Hằng đẳng thức $(A+B)^2=A^2+2AB+B^2$.",
         [("$x^2+4x+4$", True), ("$x^2+2x+4$", False), ("$x^2+4$", False), ("$x^2+4x+2$", False)]),
        ("easy", "Tích $5x^2 \\cdot 3x^3$ bằng?",
         "Nhân hệ số và cộng số mũ: $5\\cdot3=15$, $x^{2+3}=x^5$.",
         [("$15x^5$", True), ("$8x^5$", False), ("$15x^6$", False), ("$8x^6$", False)]),
        ("medium", "Kết quả của $(x^3 - x^2) : x^2$ là?",
         "Chia từng hạng tử cho $x^2$: $x^3:x^2=x$, $x^2:x^2=1$.",
         [("$x-1$", True), ("$x+1$", False), ("$x^2-1$", False), ("$x$", False)]),
        ("medium", "Phân tích đa thức $x^2 - 5x$ thành nhân tử?",
         "Đặt nhân tử chung $x$.",
         [("$x(x-5)$", True), ("$x(x+5)$", False), ("$(x-5)^2$", False), ("$5x(x-1)$", False)]),
        ("hard", "Rút gọn $(x-y)(x^2+xy+y^2)$?",
         "Hằng đẳng thức $A^3-B^3=(A-B)(A^2+AB+B^2)$.",
         [("$x^3-y^3$", True), ("$x^3+y^3$", False), ("$(x-y)^3$", False), ("$x^3-3xy-y^3$", False)]),
    ],
    1: [
        ("easy", "Phân thức $\\dfrac{1}{x-2}$ xác định khi nào?",
         "Mẫu phải khác 0: $x-2\\ne0$.",
         [("$x \\ne 2$", True), ("$x \\ne -2$", False), ("$x \\ne 0$", False), ("Mọi $x$", False)]),
        ("easy", "Rút gọn $\\dfrac{2x}{x^2}$ (với $x \\ne 0$)?",
         "Chia cả tử và mẫu cho $x$.",
         [("$\\dfrac{2}{x}$", True), ("$2x$", False), ("$\\dfrac{x}{2}$", False), ("$2$", False)]),
        ("easy", "Kết quả $\\dfrac{a}{b} \\cdot \\dfrac{c}{d}$ bằng?",
         "Nhân tử với tử, mẫu với mẫu.",
         [("$\\dfrac{ac}{bd}$", True), ("$\\dfrac{a+c}{b+d}$", False), ("$\\dfrac{ad}{bc}$", False), ("$\\dfrac{ab}{cd}$", False)]),
        ("medium", "Rút gọn $\\dfrac{x^2-1}{x+1}$ (với $x \\ne -1$)?",
         "$x^2-1=(x-1)(x+1)$, rút gọn với $(x+1)$.",
         [("$x-1$", True), ("$x+1$", False), ("$x^2-1$", False), ("$\\dfrac{1}{x+1}$", False)]),
        ("medium", "Kết quả $\\dfrac{1}{x} + \\dfrac{1}{y}$ bằng?",
         "Quy đồng mẫu chung $xy$.",
         [("$\\dfrac{x+y}{xy}$", True), ("$\\dfrac{2}{x+y}$", False), ("$\\dfrac{1}{xy}$", False), ("$\\dfrac{xy}{x+y}$", False)]),
        ("hard", "Rút gọn $\\dfrac{x^2-4}{x^2-4x+4}$ (với $x \\ne 2$)?",
         "$x^2-4=(x-2)(x+2)$, $x^2-4x+4=(x-2)^2$.",
         [("$\\dfrac{x+2}{x-2}$", True), ("$\\dfrac{x-2}{x+2}$", False), ("$x+2$", False), ("$1$", False)]),
    ],
    2: [
        ("easy", "Nghiệm của phương trình $2x - 6 = 0$ là?",
         "$2x=6 \\Rightarrow x=3$.",
         [("$x = 3$", True), ("$x = -3$", False), ("$x = 6$", False), ("$x = 2$", False)]),
        ("easy", "Giải phương trình $3x = 12$.",
         "Chia hai vế cho 3.",
         [("$x = 4$", True), ("$x = 3$", False), ("$x = 9$", False), ("$x = 36$", False)]),
        ("easy", "Nghiệm của $x + 5 = 0$ là?",
         "Chuyển vế: $x=-5$.",
         [("$x = -5$", True), ("$x = 5$", False), ("$x = 0$", False), ("$x = -1$", False)]),
        ("medium", "Giải phương trình $2(x-1) = x + 3$.",
         "$2x-2=x+3 \\Rightarrow x=5$.",
         [("$x = 5$", True), ("$x = 1$", False), ("$x = -5$", False), ("$x = 2$", False)]),
        ("medium", "Nghiệm của $\\dfrac{x}{2} + 1 = 3$ là?",
         "$\\dfrac{x}{2}=2 \\Rightarrow x=4$.",
         [("$x = 4$", True), ("$x = 2$", False), ("$x = 6$", False), ("$x = 8$", False)]),
        ("hard", "Giải phương trình $\\dfrac{x-1}{2} = \\dfrac{x+2}{3}$.",
         "Nhân chéo: $3(x-1)=2(x+2) \\Rightarrow 3x-3=2x+4 \\Rightarrow x=7$.",
         [("$x = 7$", True), ("$x = 5$", False), ("$x = 1$", False), ("$x = -7$", False)]),
    ],
    3: [
        ("easy", "Tổng số đo các góc trong một tứ giác bằng?",
         "Định lý tổng bốn góc của tứ giác.",
         [("$360^\\circ$", True), ("$180^\\circ$", False), ("$270^\\circ$", False), ("$540^\\circ$", False)]),
        ("easy", "Hình thang là tứ giác có?",
         "Định nghĩa hình thang.",
         [("Hai cạnh đối song song", True), ("Bốn cạnh bằng nhau", False),
          ("Bốn góc vuông", False), ("Hai đường chéo bằng nhau", False)]),
        ("easy", "Phát biểu: 'Hình bình hành có các cạnh đối song song'. Đúng hay sai?",
         "Đây là tính chất cơ bản của hình bình hành.",
         [("Đúng", True), ("Sai", False)]),
        ("medium", "Một tứ giác có ba góc bằng $90^\\circ$ thì góc thứ tư bằng?",
         "$360^\\circ - 3\\cdot90^\\circ = 90^\\circ$.",
         [("$90^\\circ$", True), ("$60^\\circ$", False), ("$120^\\circ$", False), ("$45^\\circ$", False)]),
        ("medium", "Tứ giác có ba góc $80^\\circ, 100^\\circ, 90^\\circ$ thì góc còn lại bằng?",
         "$360^\\circ - (80+100+90)^\\circ = 90^\\circ$.",
         [("$90^\\circ$", True), ("$80^\\circ$", False), ("$100^\\circ$", False), ("$70^\\circ$", False)]),
        ("hard", "Hai đường chéo của hình chữ nhật có tính chất nào?",
         "Hình chữ nhật: hai đường chéo bằng nhau và cắt nhau tại trung điểm mỗi đường.",
         [("Bằng nhau và cắt nhau tại trung điểm", True),
          ("Vuông góc với nhau", False),
          ("Là phân giác các góc", False),
          ("Song song với nhau", False)]),
    ],
    4: [
        ("easy", "Diện tích hình chữ nhật có chiều dài 5 và chiều rộng 3 là?",
         "$S = dài \\times rộng = 5 \\times 3$.",
         [("$15$", True), ("$8$", False), ("$16$", False), ("$30$", False)]),
        ("easy", "Diện tích hình vuông cạnh 4 là?",
         "$S = a^2 = 4^2$.",
         [("$16$", True), ("$8$", False), ("$12$", False), ("$4$", False)]),
        ("easy", "Tổng số đo các góc trong một tam giác bằng?",
         "Định lý tổng ba góc tam giác.",
         [("$180^\\circ$", True), ("$360^\\circ$", False), ("$90^\\circ$", False), ("$270^\\circ$", False)]),
        ("medium", "Diện tích tam giác có đáy 6 và chiều cao 4 là?",
         "$S = \\dfrac{1}{2} \\times 6 \\times 4 = 12$.",
         [("$12$", True), ("$24$", False), ("$10$", False), ("$48$", False)]),
        ("medium", "Tổng số đo các góc trong của một ngũ giác (5 cạnh) là?",
         "$(n-2)\\cdot180^\\circ = 3\\cdot180^\\circ = 540^\\circ$.",
         [("$540^\\circ$", True), ("$360^\\circ$", False), ("$720^\\circ$", False), ("$450^\\circ$", False)]),
        ("hard", "Diện tích hình thang có hai đáy 4 và 6, chiều cao 5 là?",
         "$S = \\dfrac{(4+6)}{2} \\times 5 = 25$.",
         [("$25$", True), ("$50$", False), ("$30$", False), ("$20$", False)]),
    ],
    5: [
        ("easy", "Hai tam giác đồng dạng thì các góc tương ứng?",
         "Định nghĩa hai tam giác đồng dạng.",
         [("Bằng nhau", True), ("Bù nhau", False), ("Phụ nhau", False), ("Gấp đôi nhau", False)]),
        ("easy", "Hai tam giác đồng dạng với tỉ số $k=2$ thì tỉ số chu vi bằng?",
         "Tỉ số chu vi bằng tỉ số đồng dạng $k$.",
         [("$2$", True), ("$4$", False), ("$1$", False), ("$\\dfrac{1}{2}$", False)]),
        ("easy", "Phát biểu: 'Hai tam giác bằng nhau thì đồng dạng với tỉ số 1'. Đúng hay sai?",
         "Tam giác bằng nhau là trường hợp đặc biệt của đồng dạng với $k=1$.",
         [("Đúng", True), ("Sai", False)]),
        ("medium", "Hai tam giác đồng dạng tỉ số $k=3$ thì tỉ số diện tích bằng?",
         "Tỉ số diện tích bằng $k^2 = 9$.",
         [("$9$", True), ("$3$", False), ("$6$", False), ("$27$", False)]),
        ("medium", "$\\triangle ABC \\sim \\triangle DEF$ với $AB=4, DE=8, BC=5$. Khi đó $EF$ bằng?",
         "Tỉ số đồng dạng $=8/4=2$, nên $EF=5\\cdot2=10$.",
         [("$10$", True), ("$5$", False), ("$8$", False), ("$2.5$", False)]),
        ("hard", "Một cây có bóng dài 6m; cùng lúc cọc cao 1,5m có bóng 2m. Chiều cao của cây là?",
         "Tam giác đồng dạng: chiều cao $=1{,}5 \\times \\dfrac{6}{2} = 4{,}5$ m.",
         [("$4{,}5$ m", True), ("$8$ m", False), ("$3$ m", False), ("$9$ m", False)]),
    ],
}

# ---------------------------------------------------------------------------
# Bài kiểm tra cuối kỳ (exam_configs.questions JSONB).
# Format từng câu khớp ExamQuestionResponse:
#   id, text, type(single|multiple), options[], correctIndices[], explanation, points, difficulty
# ---------------------------------------------------------------------------
EXAMS = [
    {
        "slot": 0,
        "name": "Bài kiểm tra giữa kỳ — Đại số (Chương 1-3)",
        "desc": "Tổng hợp kiến thức đa thức, phân thức và phương trình bậc nhất một ẩn.",
        "duration": 45, "pass": 50, "max_attempts": 2,
        "questions": [
            ("easy", "single", "Khai triển $(x+1)^2$ ta được?",
             ["$x^2+2x+1$", "$x^2+1$", "$x^2+x+1$", "$x^2+2x$"], [0],
             "Hằng đẳng thức $(A+B)^2$.", 1.0),
            ("easy", "single", "Nghiệm của phương trình $4x - 8 = 0$ là?",
             ["$x=2$", "$x=-2$", "$x=4$", "$x=8$"], [0], "$4x=8 \\Rightarrow x=2$.", 1.0),
            ("medium", "single", "Rút gọn $\\dfrac{x^2-9}{x+3}$ (với $x \\ne -3$)?",
             ["$x-3$", "$x+3$", "$x^2-3$", "$\\dfrac{1}{x+3}$"], [0],
             "$x^2-9=(x-3)(x+3)$.", 2.0),
            ("medium", "single", "Giải phương trình $3(x-2) = x + 4$.",
             ["$x=5$", "$x=2$", "$x=-5$", "$x=1$"], [0],
             "$3x-6=x+4 \\Rightarrow 2x=10 \\Rightarrow x=5$.", 2.0),
            ("hard", "single", "Rút gọn $(x-2)(x^2+2x+4)$?",
             ["$x^3-8$", "$x^3+8$", "$(x-2)^3$", "$x^3-2$"], [0],
             "Hằng đẳng thức $A^3-B^3$ với $B=2$.", 2.0),
            ("medium", "multiple", "Chọn TẤT CẢ phương trình bậc nhất một ẩn:",
             ["$2x+1=0$", "$x^2-1=0$", "$3x=9$", "$x+y=2$"], [0, 2],
             "Bậc nhất một ẩn có dạng $ax+b=0$ với $a\\ne0$, chỉ một ẩn.", 2.0),
        ],
    },
    {
        "slot": 1,
        "name": "Bài kiểm tra cuối kỳ — Hình học (Chương 4-6)",
        "desc": "Tổng hợp tứ giác, diện tích đa giác và tam giác đồng dạng.",
        "duration": 45, "pass": 50, "max_attempts": 2,
        "questions": [
            ("easy", "single", "Tổng số đo các góc trong một tứ giác bằng?",
             ["$360^\\circ$", "$180^\\circ$", "$270^\\circ$", "$540^\\circ$"], [0],
             "Định lý tổng bốn góc tứ giác.", 1.0),
            ("easy", "single", "Diện tích hình vuông cạnh 5 là?",
             ["$25$", "$10$", "$20$", "$5$"], [0], "$S=a^2=5^2$.", 1.0),
            ("medium", "single", "Diện tích tam giác có đáy 8 và chiều cao 3 là?",
             ["$12$", "$24$", "$11$", "$48$"], [0], "$S=\\dfrac{1}{2}\\cdot8\\cdot3$.", 2.0),
            ("medium", "single", "Hai tam giác đồng dạng tỉ số $k=2$ thì tỉ số diện tích bằng?",
             ["$4$", "$2$", "$8$", "$16$"], [0], "Tỉ số diện tích $=k^2$.", 2.0),
            ("hard", "single", "Diện tích hình thang hai đáy 3 và 7, chiều cao 4 là?",
             ["$20$", "$40$", "$15$", "$28$"], [0], "$S=\\dfrac{(3+7)}{2}\\cdot4=20$.", 2.0),
            ("medium", "multiple", "Chọn TẤT CẢ phát biểu ĐÚNG về hình bình hành:",
             ["Các cạnh đối song song", "Có bốn góc vuông",
              "Các cạnh đối bằng nhau", "Hai đường chéo luôn bằng nhau"], [0, 2],
             "Bốn góc vuông là hình chữ nhật; đường chéo bằng nhau cũng là hình chữ nhật.", 2.0),
        ],
    },
]


def main():
    env = {}
    for line in open("backend/.env", encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

    conn = psycopg2.connect(
        host=env["SUPABASE_DB_HOST"], port=env["SUPABASE_DB_PORT"],
        dbname=env["SUPABASE_DB_NAME"], user=env["SUPABASE_DB_USER"],
        password=env["SUPABASE_DB_PASSWORD"], sslmode="require", connect_timeout=20)
    conn.autocommit = False
    cur = conn.cursor()

    # 1) Course --------------------------------------------------------------
    cur.execute("""
        INSERT INTO public.courses
            (id, slug, title, description, thumbnail_url, category_id, teacher_id,
             grades, price_vnd, sale_price_vnd, status, is_featured, published_at,
             intro_video_url, objective, audience)
        VALUES (%s,%s,%s,%s,%s,%s,%s, ARRAY[%s]::integer[], %s,%s,
                'published'::course_status, true, now(), %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            title=EXCLUDED.title, description=EXCLUDED.description,
            thumbnail_url=EXCLUDED.thumbnail_url, category_id=EXCLUDED.category_id,
            grades=EXCLUDED.grades, price_vnd=EXCLUDED.price_vnd,
            sale_price_vnd=EXCLUDED.sale_price_vnd, status=EXCLUDED.status,
            is_featured=EXCLUDED.is_featured, intro_video_url=EXCLUDED.intro_video_url,
            objective=EXCLUDED.objective, audience=EXCLUDED.audience, updated_at=now()
    """, (
        COURSE_ID, "toan-8-nen-tang-dai-so-va-hinh-hoc",
        "Toán 8: Nền Tảng Đại Số & Hình Học",
        "Khóa học bám sát chương trình Toán lớp 8 với 6 chương trọng tâm: từ phép nhân/chia đa thức, "
        "phân thức đại số, phương trình bậc nhất một ẩn đến tứ giác, diện tích đa giác và tam giác đồng dạng. "
        "Mỗi chương có video bài giảng, quiz luyện tập và bài kiểm tra tổng hợp giúp học sinh nắm vững kiến thức.",
        "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80",
        CATEGORY_TOAN, TEACHER_ID, GRADE, 599000, 449000,
        INTRO_VIDEO,
        "Nắm vững toàn bộ kiến thức Toán 8 và tự tin giải mọi dạng bài tập trong sách giáo khoa.",
        "Học sinh lớp 8 muốn củng cố kiến thức và ôn luyện chuẩn bị cho các kỳ kiểm tra.",
    ))

    for ci, ch in enumerate(CHAPTERS):
        chapter_id = U(f"ch{ci}")
        cur.execute("""
            INSERT INTO public.chapters (id, course_id, title, description, position)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                title=EXCLUDED.title, description=EXCLUDED.description, position=EXCLUDED.position
        """, (chapter_id, COURSE_ID, ch["title"], ch["desc"], ci + 1))

        # Lessons — dùng video YouTube nhúng (video_embed_url), bỏ trống video_url.
        for li, (title, desc, is_free) in enumerate(ch["lessons"]):
            lesson_id = U(f"ch{ci}.l{li}")
            embed = LESSON_VIDEOS[ci][li]
            duration = 600 + li * 300  # 10', 15', 20'
            cur.execute("""
                INSERT INTO public.lessons
                    (id, chapter_id, title, description, video_url, video_embed_url,
                     duration_sec, position, is_free)
                VALUES (%s,%s,%s,%s, NULL, %s, %s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET
                    title=EXCLUDED.title, description=EXCLUDED.description,
                    video_url=NULL, video_embed_url=EXCLUDED.video_embed_url,
                    duration_sec=EXCLUDED.duration_sec,
                    position=EXCLUDED.position, is_free=EXCLUDED.is_free
            """, (lesson_id, chapter_id, title, desc, embed, duration, li + 1, is_free))

        # Questions + choices
        q_ids = []
        for qi, (diff, content, expl, choices) in enumerate(QUESTIONS[ci]):
            q_id = U(f"q.ch{ci}.{qi}")
            q_ids.append(q_id)
            qtype = "true_false" if len(choices) == 2 else "multiple_choice"
            cur.execute("""
                INSERT INTO public.questions
                    (id, teacher_id, category_id, chapter_id, grade, content, explanation,
                     difficulty, type, status, usage_count)
                VALUES (%s,%s,%s,%s,%s,%s,%s, %s::question_difficulty, %s::question_type, 'active'::question_status, 0)
                ON CONFLICT (id) DO UPDATE SET
                    content=EXCLUDED.content, explanation=EXCLUDED.explanation,
                    difficulty=EXCLUDED.difficulty, type=EXCLUDED.type,
                    chapter_id=EXCLUDED.chapter_id, updated_at=now()
            """, (q_id, TEACHER_ID, CATEGORY_TOAN, chapter_id, GRADE, content, expl, diff, qtype))

            # Refresh choices for idempotency
            cur.execute("DELETE FROM public.question_choices WHERE question_id=%s", (q_id,))
            rows = []
            for k, (ctext, correct) in enumerate(choices):
                rows.append((U(f"c.ch{ci}.{qi}.{k}"), q_id, ctext, correct, k + 1))
            execute_values(cur,
                "INSERT INTO public.question_choices (id, question_id, content, is_correct, position) VALUES %s",
                rows)

        # Quiz config (manual — dùng 5 câu đầu của chương)
        quiz_id = U(f"quiz.ch{ci}")
        selected = q_ids[:5]
        cur.execute("""
            INSERT INTO public.quiz_configs
                (id, chapter_id, teacher_id, total_questions, easy_count, medium_count, hard_count,
                 time_limit_minutes, passing_score, shuffle_questions, shuffle_choices, max_attempts,
                 selection_mode, selected_question_ids)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,true,true,%s,'manual', %s::uuid[])
            ON CONFLICT (id) DO UPDATE SET
                total_questions=EXCLUDED.total_questions, easy_count=EXCLUDED.easy_count,
                medium_count=EXCLUDED.medium_count, hard_count=EXCLUDED.hard_count,
                time_limit_minutes=EXCLUDED.time_limit_minutes, passing_score=EXCLUDED.passing_score,
                max_attempts=EXCLUDED.max_attempts, selection_mode=EXCLUDED.selection_mode,
                selected_question_ids=EXCLUDED.selected_question_ids, updated_at=now()
        """, (quiz_id, chapter_id, TEACHER_ID, len(selected), 3, 2, 0, 15, 6.0, 3, selected))

    # 2) Exams ---------------------------------------------------------------
    for ex in EXAMS:
        exam_id = U(f"exam.{ex['slot']}")
        qlist = []
        for qi, (diff, qtype, text, options, correct, expl, pts) in enumerate(ex["questions"]):
            qlist.append({
                "id": U(f"exam.{ex['slot']}.q{qi}"),
                "text": text, "type": qtype, "options": options,
                "correctIndices": correct, "explanation": expl,
                "points": pts, "difficulty": diff,
            })
        cur.execute("""
            INSERT INTO public.exam_configs
                (id, course_id, teacher_id, slot_index, name, description, duration_minutes,
                 pass_score_percent, max_attempts, shuffle_questions, shuffle_options,
                 show_answer_after_submit, questions)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,true,true,true,%s::jsonb)
            ON CONFLICT (course_id, slot_index) DO UPDATE SET
                name=EXCLUDED.name, description=EXCLUDED.description,
                duration_minutes=EXCLUDED.duration_minutes, pass_score_percent=EXCLUDED.pass_score_percent,
                max_attempts=EXCLUDED.max_attempts, questions=EXCLUDED.questions, updated_at=now()
        """, (exam_id, COURSE_ID, TEACHER_ID, ex["slot"], ex["name"], ex["desc"],
              ex["duration"], ex["pass"], ex["max_attempts"], json.dumps(qlist, ensure_ascii=False)))

    # 3) Recalculate denormalized counters on course ------------------------
    cur.execute("""
        UPDATE public.courses c SET
            total_chapters = sub.tc, total_lessons = sub.tl, total_duration_sec = sub.td
        FROM (
            SELECT ch.course_id,
                   COUNT(DISTINCT ch.id) AS tc,
                   COUNT(l.id) AS tl,
                   COALESCE(SUM(l.duration_sec),0)::int AS td
            FROM public.chapters ch
            LEFT JOIN public.lessons l ON l.chapter_id = ch.id
            WHERE ch.course_id = %s
            GROUP BY ch.course_id
        ) sub
        WHERE c.id = sub.course_id
    """, (COURSE_ID,))

    conn.commit()

    # Verify -----------------------------------------------------------------
    cur.execute("""
        SELECT c.title, c.status, c.total_chapters, c.total_lessons, c.total_duration_sec,
               (SELECT count(*) FROM questions q WHERE q.teacher_id=%s
                  AND q.category_id=%s AND q.grade=%s) AS total_questions,
               (SELECT count(*) FROM quiz_configs qc
                  JOIN chapters ch ON ch.id=qc.chapter_id WHERE ch.course_id=c.id) AS quizzes,
               (SELECT count(*) FROM exam_configs e WHERE e.course_id=c.id) AS exams
        FROM courses c WHERE c.id=%s
    """, (TEACHER_ID, CATEGORY_TOAN, GRADE, COURSE_ID))
    row = cur.fetchone()
    print("KHÓA HỌC ĐÃ TẠO:")
    print(f"  Tiêu đề     : {row[0]}")
    print(f"  Trạng thái  : {row[1]}")
    print(f"  Số chương   : {row[2]}")
    print(f"  Số bài học  : {row[3]}")
    print(f"  Tổng thời lượng: {row[4]//60} phút")
    print(f"  Câu hỏi (NH): {row[5]}")
    print(f"  Quiz chương : {row[6]}")
    print(f"  Bài kiểm tra: {row[7]}")
    print(f"  Course ID   : {COURSE_ID}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
