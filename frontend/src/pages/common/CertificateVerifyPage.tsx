import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Header from '../../components/Header';
import {
  verifyCertificate,
  type CertificateVerificationResponse,
} from '../../api/certificateService';

function formatDate(value: string | null): string {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CertificateVerifyPage() {
  const { verificationCode = '' } = useParams();
  const [data, setData] = useState<CertificateVerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    verifyCertificate(verificationCode)
      .then(result => {
        setData(result);
        setError(null);
      })
      .catch(err => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Không xác thực được chứng chỉ');
      })
      .finally(() => setLoading(false));
  }, [verificationCode]);

  return (
    <div className="min-h-screen bg-surface font-sans">
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-8 text-center shadow-sm">
          {loading ? (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <h1 className="text-xl font-extrabold text-on-surface">Đang xác thực chứng chỉ...</h1>
            </>
          ) : error || !data ? (
            <>
              <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
              <h1 className="text-2xl font-extrabold text-on-surface">Không tìm thấy chứng chỉ</h1>
              <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
            </>
          ) : (
            <>
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                data.valid ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-600'
              }`}>
                {data.valid ? <CheckCircle2 className="h-9 w-9" /> : <Award className="h-9 w-9" />}
              </div>
              <p className="text-sm font-bold uppercase text-primary">Bee Academy Certificate</p>
              <h1 className="mt-2 text-2xl font-extrabold text-on-surface">
                {data.valid ? 'Chứng chỉ hợp lệ' : 'Chứng chỉ không còn hiệu lực'}
              </h1>
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
                <Info label="Mã chứng chỉ" value={data.certificateNo} />
                <Info label="Trạng thái" value={data.status} />
                <Info label="Học sinh" value={data.studentName ?? '-'} />
                <Info label="Khóa học" value={data.courseTitle} />
                <Info label="Giáo viên" value={data.teacherName ?? '-'} />
                <Info label="Ngày cấp" value={formatDate(data.issuedAt)} />
              </div>
            </>
          )}

          <Link
            to="/courses"
            className="mt-8 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Về Bee Academy
          </Link>
        </section>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}
