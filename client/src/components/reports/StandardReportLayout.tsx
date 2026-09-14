import type { ReactNode } from "react";

export type StandardReportSignature = {
  fileUrl: string;
  signerName: string | null;
  signedAt: Date;
};

export function StandardDocumentHeader({
  title,
  eyebrow,
  storeName,
  leadText,
  requestNumber,
  reportDate,
  status,
}: {
  title: string;
  eyebrow: string;
  storeName: string;
  leadText: string;
  requestNumber: string;
  reportDate: string;
  status?: string;
}) {
  return (
    <header data-report-layout="standard" className="mb-5">
      <div className="flex min-h-[17mm] items-center justify-between bg-[#17324d] px-4 py-3 text-white">
        <div>
          <h1 className="font-serif-jp text-[24px] font-bold tracking-[0.18em]">{title}</h1>
          <p className="mt-1 text-[9px] tracking-[0.28em] text-white/75">{eyebrow}</p>
        </div>
        {status && (
          <span className="border border-white/45 bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-wide">
            {status}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-5 border-b border-[#cbd5e1] pb-3">
        <div className="min-w-0">
          <p className="font-serif-jp text-[15px] font-semibold text-[#17324d]">{storeName}　御中</p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[#667085]">{leadText}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] leading-relaxed text-[#475467] tabular-nums">
          <p>案件番号：{requestNumber}</p>
          <p>報告日：{reportDate}</p>
        </div>
      </div>
    </header>
  );
}

export function StandardSectionBand({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-4 flex min-h-[9mm] items-center justify-between gap-3 bg-[#244361] px-3 py-1.5 text-white">
      <span className="font-serif-jp text-[13px] font-semibold tracking-wide">{children}</span>
      {aside && <span className="text-[9px] font-normal text-white/75">{aside}</span>}
    </div>
  );
}

export function StandardReportTh({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <th
      colSpan={colSpan}
      className="border border-[#cbd5e1] bg-[#eef2f6] px-2.5 py-2 text-left text-[10.5px] font-semibold text-[#344054] align-middle whitespace-nowrap"
    >
      {children}
    </th>
  );
}

export function StandardReportTd({
  children,
  colSpan,
  className = "",
}: {
  children: ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-[#cbd5e1] bg-white px-2.5 py-2 text-[10.5px] text-[#1f2937] align-middle ${className}`}
    >
      {children}
    </td>
  );
}

export function StandardReportFooter({
  documentTitle,
  requestNumber,
  pageNo,
  totalPages,
}: {
  documentTitle: string;
  requestNumber: string;
  pageNo: number;
  totalPages: number;
}) {
  return (
    <footer className="mt-3 flex shrink-0 items-center justify-between border-t border-[#cbd5e1] pt-1.5 text-[8px] text-[#667085]">
      <span>{documentTitle}｜案件番号 {requestNumber}</span>
      <span className="tabular-nums">ページ {pageNo} / {totalPages}</span>
    </footer>
  );
}

export function StandardSignatureBlock({
  signature,
  secondarySignature,
  primaryLabel = "プレナス責任者サイン",
  secondaryLabel = "先方確認サイン",
}: {
  signature: StandardReportSignature | null | undefined;
  secondarySignature?: StandardReportSignature | null;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const signedDate = signature
    ? new Date(signature.signedAt).toLocaleDateString("ja-JP")
    : "　年　月　日";
  const secondarySignedDate = secondarySignature
    ? new Date(secondarySignature.signedAt).toLocaleDateString("ja-JP")
    : "　年　月　日";

  return (
    <section data-report-signature="true">
      <StandardSectionBand>確認・署名欄</StandardSectionBand>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[#cbd5e1] bg-white p-3">
          <p className="mb-1.5 text-[10px] font-semibold text-[#344054]">{primaryLabel}</p>
          <div className="relative flex h-[22mm] items-end justify-center border-b border-[#667085] bg-[#fbfcfd]">
            {signature ? (
              <img
                src={signature.fileUrl}
                alt="保存済みサイン"
                className="max-h-[20mm] max-w-full object-contain pb-0.5"
                crossOrigin="anonymous"
              />
            ) : (
              <span className="absolute bottom-1 left-1 text-[9px] text-[#98a2b3]">手書きサイン</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#667085]">
            <span>氏名：<span className="text-[#1f2937]">{signature?.signerName || "　　　　　　"}</span></span>
            <span>日付：<span className="text-[#1f2937]">{signedDate}</span></span>
          </div>
        </div>
        <div className="border border-[#cbd5e1] bg-white p-3">
          <p className="mb-1.5 text-[10px] font-semibold text-[#344054]">{secondaryLabel}</p>
          <div className="relative flex h-[22mm] items-end justify-center border-b border-[#667085] bg-[#fbfcfd]">
            {secondarySignature ? (
              <img
                src={secondarySignature.fileUrl}
                alt="保存済み先方サイン"
                className="max-h-[20mm] max-w-full object-contain pb-0.5"
                crossOrigin="anonymous"
              />
            ) : (
              <span className="absolute bottom-1 left-1 text-[9px] text-[#98a2b3]">手書きサイン</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#667085]">
            <span>氏名：<span className="text-[#1f2937]">{secondarySignature?.signerName || "　　　　　　"}</span></span>
            <span>日付：<span className="text-[#1f2937]">{secondarySignedDate}</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
