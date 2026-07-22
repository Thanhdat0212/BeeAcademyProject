import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import {
  getRewardWallet,
  redeemRewardVoucher,
  type RewardVoucher,
  type RewardWallet,
} from '../../api/rewardService';
import { isApiError } from '../../api/client';
import { notify } from '../../lib/toast';

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatVnd(value: number): string {
  return value.toLocaleString('vi-VN') + 'đ';
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function voucherStatusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Sẵn sàng dùng';
    case 'RESERVED':
      return 'Đang giữ cho đơn hàng';
    case 'USED':
      return 'Đã sử dụng';
    default:
      return status;
  }
}

function voucherStatusClass(status: string): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-500/10 text-green-700';
    case 'RESERVED':
      return 'bg-amber-500/10 text-amber-700';
    case 'USED':
      return 'bg-slate-500/10 text-slate-700';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

function SummaryCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-5 shadow-sm">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-on-surface">{value}</p>
      <p className="mt-2 text-sm font-medium text-on-surface-variant">{note}</p>
    </div>
  );
}

function VoucherCatalogCard({
  voucher,
  availablePoints,
  redeemingId,
  onRedeem,
}: {
  voucher: RewardVoucher;
  availablePoints: number;
  redeemingId: string | null;
  onRedeem: (voucherId: string) => void;
}) {
  const canRedeem = availablePoints >= voucher.requiredPoints;
  const progressPct = Math.min(100, Math.round((availablePoints / voucher.requiredPoints) * 100));

  return (
    <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
            <Ticket className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-on-surface">{voucher.displayName}</h3>
            <p className="mt-1 text-sm font-semibold text-primary">Giảm {formatVnd(voucher.discountAmount)}</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface-variant">
          {voucher.code}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-on-surface-variant">
          <span>Cần {formatNumber(voucher.requiredPoints)} điểm</span>
          <span>{canRedeem ? 'Đủ điểm' : `${progressPct}%`}</span>
        </div>
        <div className="h-2 rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full ${canRedeem ? 'bg-green-600' : 'bg-primary'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRedeem(voucher.id)}
        disabled={!canRedeem || redeemingId !== null}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {redeemingId === voucher.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BadgePercent className="h-4 w-4" />
        )}
        {canRedeem ? 'Đổi voucher' : 'Chưa đủ điểm'}
      </button>
    </article>
  );
}

export default function RewardsPage() {
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  async function loadWallet() {
    setLoading(true);
    try {
      setWallet(await getRewardWallet());
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được điểm tích lũy');
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  const availableVoucherCount = useMemo(
    () => wallet?.vouchers.filter(voucher => voucher.status === 'AVAILABLE').length ?? 0,
    [wallet],
  );

  async function handleRedeem(voucherId: string) {
    setRedeemingId(voucherId);
    try {
      const nextWallet = await redeemRewardVoucher(voucherId);
      setWallet(nextWallet);
      notify.success('Đã đổi voucher thành công.');
    } catch (error) {
      notify.error(isApiError(error) ? error.message : 'Không thể đổi voucher. Vui lòng thử lại.');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface font-sans">
      <DashboardHeader />

      <div className="border-b border-outline-variant/30 bg-gradient-to-r from-surface-container via-surface-container to-amber-500/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-primary">Điểm tích lũy cá nhân</p>
            <h1 className="mt-1 text-3xl font-extrabold text-on-surface">Ví điểm của bạn</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Theo dõi điểm thưởng nhận được từ 4 bài kiểm tra của mỗi khóa học và các voucher đã đổi.
            </p>
          </div>
          <button
            type="button"
            onClick={loadWallet}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <p className="font-semibold text-on-surface-variant">Đang tải điểm tích lũy...</p>
            </div>
          </div>
        ) : !wallet ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
            <Coins className="mx-auto mb-4 h-14 w-14 text-on-surface-variant/50" />
            <h2 className="text-xl font-extrabold text-on-surface">Chưa thể hiển thị điểm tích lũy</h2>
            <p className="mt-2 text-sm text-on-surface-variant">Vui lòng thử làm mới sau ít phút.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <SummaryCard
                icon={<Coins className="h-5 w-5" />}
                label="Điểm khả dụng"
                value={formatNumber(wallet.availablePoints)}
                note="Có thể dùng để đổi voucher"
                tone="bg-amber-500/10 text-amber-700"
              />
              <SummaryCard
                icon={<Trophy className="h-5 w-5" />}
                label="Tổng điểm đã nhận"
                value={formatNumber(wallet.lifetimePoints)}
                note="Tính theo điểm cao nhất của mỗi bài kiểm tra"
                tone="bg-primary/10 text-primary"
              />
              <SummaryCard
                icon={<Ticket className="h-5 w-5" />}
                label="Voucher đang có"
                value={formatNumber(availableVoucherCount)}
                note="Có thể áp dụng khi thanh toán"
                tone="bg-green-500/10 text-green-700"
              />
            </div>

            <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-on-surface">Cách điểm được cộng</h2>
                    <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
                      Mỗi khóa học có 4 bài kiểm tra được tính điểm tích lũy; kết quả quiz không được tính.
                      Điểm bài kiểm tra được quy đổi theo thang 100. Nếu làm lại tốt hơn, hệ thống chỉ cộng thêm
                      phần điểm chênh lệch.
                    </p>
                  </div>
                </div>
                <Link
                  to="/checkout"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Dùng voucher
                </Link>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-extrabold text-on-surface">Đổi voucher bằng điểm</h2>
                  <span className="text-sm font-semibold text-on-surface-variant">
                    {wallet.catalog.length} lựa chọn
                  </span>
                </div>
                {wallet.catalog.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-8 text-center text-sm font-semibold text-on-surface-variant">
                    Chưa có voucher khả dụng.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {wallet.catalog.map(voucher => (
                      <VoucherCatalogCard
                        key={voucher.id}
                        voucher={voucher}
                        availablePoints={wallet.availablePoints}
                        redeemingId={redeemingId}
                        onRedeem={handleRedeem}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-extrabold text-on-surface">Voucher của tôi</h2>
                  <span className="text-sm font-semibold text-on-surface-variant">
                    {wallet.vouchers.length} voucher
                  </span>
                </div>
                {wallet.vouchers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-8 text-center">
                    <Ticket className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/45" />
                    <p className="text-sm font-semibold text-on-surface-variant">
                      Bạn chưa đổi voucher nào.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wallet.vouchers.map(voucher => (
                      <article
                        key={voucher.id}
                        className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-extrabold text-on-surface">{voucher.displayName}</h3>
                            <p className="mt-1 text-sm font-semibold text-primary">
                              {voucher.code} · Giảm {formatVnd(voucher.discountAmount)}
                            </p>
                          </div>
                          <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${voucherStatusClass(voucher.status)}`}>
                            {voucher.status === 'AVAILABLE' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {voucherStatusLabel(voucher.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-on-surface-variant">
                          Đổi lúc {formatDateTime(voucher.redeemedAt)}
                          {voucher.usedAt ? ` · Dùng lúc ${formatDateTime(voucher.usedAt)}` : ''}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
