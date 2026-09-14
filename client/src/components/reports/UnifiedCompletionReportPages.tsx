import type { ReactNode } from "react";
import type { Case, CaseSignature, Photo } from "../../../../drizzle/schema";
import type { CompletionReportContent } from "../../../../shared/completionReport";
import { pairBeforeAfterPhotos } from "../../../../shared/reportPhotoPairs";
import {
  StandardDocumentHeader,
  StandardReportFooter,
  StandardReportTd,
  StandardReportTh,
  StandardSectionBand,
  StandardSignatureBlock,
} from "./StandardReportLayout";

type PhotoPhase = "before" | "process" | "after";

type Props = {
  caseData: Case;
  content: CompletionReportContent;
  photosByPhase: Record<PhotoPhase, Photo[]>;
  captionMap: Map<number, string>;
  signature: CaseSignature | null | undefined;
  customerSignature: CaseSignature | null | undefined;
  workName: string;
  completedAt: Date | null;
  formatDate: (value: Date | null | undefined) => string;
  formatLabel: (value: string | number | null | undefined) => string;
  formatDigits: (value: string | number | null | undefined) => string;
};

type DetailSection = {
  key: string;
  heightMm: number;
  render: () => ReactNode;
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function UnifiedPage({
  children,
  caseData,
  pageNo,
  totalPages,
  formatDigits,
}: {
  children: ReactNode;
  caseData: Case;
  pageNo: number;
  totalPages: number;
  formatDigits: Props["formatDigits"];
}) {
  return (
    <section className="report-page flex flex-col bg-white text-black">
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      <StandardReportFooter
        documentTitle="工事完了報告書"
        requestNumber={formatDigits(caseData.requestNumber)}
        pageNo={pageNo}
        totalPages={totalPages}
      />
    </section>
  );
}

function CompletionStatus({ label }: { label: string }) {
  return (
    <div className="mb-4 grid grid-cols-[32mm_1fr] border-2 border-[#1e8449]">
      <div className="flex items-center bg-[#1e8449] px-3 py-2 text-[10.5px] font-semibold text-white">
        完了判定
      </div>
      <div className="flex items-center bg-[#edf8f1] px-4 py-2 text-[14px] font-bold text-[#155c37]">
        {label}
      </div>
    </div>
  );
}

function BodyText({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap text-[10.5px] leading-[1.7] text-[#25313f]">{children}</div>;
}

function EvaluationTable({
  rows,
  formatLabel,
}: {
  rows: CompletionReportContent["evaluations"];
  formatLabel: Props["formatLabel"];
}) {
  return (
    <table className="w-full table-fixed border-collapse text-[9.5px]">
      <thead>
        <tr>
          <th className="w-[19%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-left font-semibold text-white">評価項目</th>
          <th className="w-[27%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-left font-semibold text-white">施工前</th>
          <th className="w-[27%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-left font-semibold text-white">施工後</th>
          <th className="w-[27%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-left font-semibold text-white">判定</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.item}-${index}`}>
            <td className="border border-[#cbd5e1] bg-[#f8fafc] px-2 py-1.5 align-top font-semibold">{formatLabel(row.item) || "—"}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 align-top">{formatLabel(row.before) || "—"}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 align-top">{formatLabel(row.after) || "—"}</td>
            <td className="border border-[#cbd5e1] bg-[#edf8f1] px-2 py-1.5 align-top font-semibold text-[#155c37]">
              {formatLabel(row.judgment) || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvidencePhoto({
  photo,
  label,
  caption,
  color,
  formatLabel,
}: {
  photo: Photo | null;
  label: string;
  caption?: string;
  color: "before" | "after";
  formatLabel: Props["formatLabel"];
}) {
  const bandColor = color === "before" ? "bg-[#b42318]" : "bg-[#15713f]";
  const borderColor = color === "before" ? "border-[#b42318]" : "border-[#15713f]";
  return (
    <div className={`flex min-h-0 flex-col border-2 ${borderColor} bg-white`}>
      <div className={`${bandColor} flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold text-white`}>
        <span>{label}</span>
        {photo?.photoType && <span className="text-[8.5px] font-normal text-white/80">{photo.photoType}</span>}
      </div>
      <div className="flex h-[58mm] items-center justify-center overflow-hidden bg-[#f4f6f8]">
        {photo ? (
          <img
            src={photo.fileUrl}
            alt={label}
            className="h-full w-full object-contain"
            style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined }}
            crossOrigin="anonymous"
          />
        ) : (
          <div className="px-5 text-center text-[10px] leading-relaxed text-[#98a2b3]">
            対応する{color === "before" ? "施工前" : "施工後"}写真は登録されていません
          </div>
        )}
      </div>
      <div className="min-h-[13mm] border-t border-[#cbd5e1] px-2.5 py-2 text-[9px] leading-[1.5] text-[#344054]">
        {photo
          ? formatLabel(caption?.trim() || photo.memo?.trim() || `${label}の状態`)
          : "写真未登録のため、単独写真として掲載しています。"}
      </div>
    </div>
  );
}

function ProcessPhoto({ photo, caption, formatLabel }: { photo: Photo; caption?: string; formatLabel: Props["formatLabel"] }) {
  return (
    <div className="flex min-h-0 flex-col border border-[#cbd5e1] bg-white">
      <div className="flex h-[48mm] items-center justify-center overflow-hidden bg-[#f4f6f8]">
        <img
          src={photo.fileUrl}
          alt="施工中写真"
          className="h-full w-full object-contain"
          style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined }}
          crossOrigin="anonymous"
        />
      </div>
      <div className="bg-[#2471a3] px-2 py-1 text-[9px] font-semibold text-white">PROCESS｜施工中</div>
      <div className="min-h-[11mm] px-2 py-1.5 text-[8.5px] leading-[1.45] text-[#344054]">
        {formatLabel(caption?.trim() || photo.memo?.trim() || "施工中の状況")}
      </div>
    </div>
  );
}

export function UnifiedCompletionReportPages({
  caseData,
  content,
  photosByPhase,
  captionMap,
  signature,
  customerSignature,
  workName,
  completedAt,
  formatDate,
  formatLabel,
  formatDigits,
}: Props) {
  const issuedAt = new Date();
  const beforeAfterPairs = pairBeforeAfterPhotos(
    photosByPhase.before,
    photosByPhase.after,
    content.manualPhotoPairs,
  );
  const comparisonPages = chunk(beforeAfterPairs, 2);
  const processPages = chunk(photosByPhase.process, 6);
  const hasAnyPhoto = beforeAfterPairs.length > 0 || photosByPhase.process.length > 0;
  const photoPageCount = hasAnyPhoto ? comparisonPages.length + processPages.length : 1;
  const evaluationPages = content.evaluations.length > 0 ? chunk(content.evaluations, 7) : [[]];

  const detailSections: DetailSection[] = [];
  if (content.measurements.length > 0) {
    detailSections.push({
      key: "measurements",
      heightMm: 12 + content.measurements.length * 7,
      render: () => (
        <>
          <StandardSectionBand>採寸データ・実測値</StandardSectionBand>
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              {content.measurements.map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <StandardReportTh>{formatLabel(row.name) || "計測箇所"}</StandardReportTh>
                  <StandardReportTd>{formatLabel(row.value) || "—"}</StandardReportTd>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }
  if (content.materials.length > 0) {
    detailSections.push({
      key: "materials",
      heightMm: 18 + content.materials.length * 7,
      render: () => (
        <>
          <StandardSectionBand>使用材料</StandardSectionBand>
          <table className="w-full table-fixed border-collapse text-[9px]">
            <thead><tr><th className="border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">材料・部材名</th><th className="border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">規格・仕様</th><th className="w-[22%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">数量</th></tr></thead>
            <tbody>
              {content.materials.map((row, index) => (
                <tr key={`${row.name}-${index}`}><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.name) || "—"}</td><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.spec) || "—"}</td><td className="border border-[#cbd5e1] px-2 py-1.5 text-center">{formatLabel(row.qty) || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }
  if (content.procedures.length > 0) {
    detailSections.push({
      key: "procedures",
      heightMm: 14 + content.procedures.length * 8,
      render: () => (
        <>
          <StandardSectionBand>施工手順</StandardSectionBand>
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              {content.procedures.map((row, index) => (
                <tr key={`${row.step}-${index}`}><th className="w-[15%] border border-[#cbd5e1] bg-[#eef2f6] px-2 py-1.5 text-center">{formatDigits(row.step || index + 1)}</th><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.detail) || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }
  if (content.conclusion.trim()) {
    detailSections.push({
      key: "conclusion",
      heightMm: 35,
      render: () => <><StandardSectionBand>工事完了結論・次のアクション</StandardSectionBand><div className="border border-[#9ed4b1] bg-[#edf8f1] px-4 py-3"><BodyText>{formatLabel(content.conclusion)}</BodyText></div></>,
    });
  }
  if (content.inspections.length > 0) {
    detailSections.push({
      key: "inspections",
      heightMm: 18 + content.inspections.length * 8,
      render: () => (
        <><StandardSectionBand>次回点検・予防保全</StandardSectionBand><table className="w-full table-fixed border-collapse text-[9px]"><thead><tr><th className="w-[20%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">推奨時期</th><th className="w-[28%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">点検対象</th><th className="border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">観点・内容</th></tr></thead><tbody>{content.inspections.map((row, index) => <tr key={`${row.target}-${index}`}><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.timing) || "—"}</td><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.target) || "—"}</td><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.note) || "—"}</td></tr>)}</tbody></table></>
      ),
    });
  }
  if (content.risks.length > 0) {
    detailSections.push({
      key: "risks",
      heightMm: 18 + content.risks.length * 8,
      render: () => (
        <><StandardSectionBand>周辺部位の連鎖リスク</StandardSectionBand><table className="w-full table-fixed border-collapse text-[9px]"><thead><tr><th className="w-[24%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">周辺部位</th><th className="border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">想定リスク</th><th className="w-[18%] border border-[#cbd5e1] bg-[#244361] px-2 py-1.5 text-white">注意度</th></tr></thead><tbody>{content.risks.map((row, index) => <tr key={`${row.part}-${index}`}><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.part) || "—"}</td><td className="border border-[#cbd5e1] px-2 py-1.5">{formatLabel(row.risk) || "—"}</td><td className="border border-[#cbd5e1] bg-[#fff7e6] px-2 py-1.5 text-center font-semibold">{formatLabel(row.level) || "—"}</td></tr>)}</tbody></table></>
      ),
    });
  }

  const detailPages: ReactNode[][] = [];
  let currentPage: ReactNode[] = [];
  let currentHeight = 0;
  for (const section of detailSections) {
    if (currentPage.length > 0 && currentHeight + section.heightMm > 225) {
      detailPages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }
    currentPage.push(<div key={section.key}>{section.render()}</div>);
    currentHeight += section.heightMm;
  }
  if (currentPage.length > 0) detailPages.push(currentPage);

  const totalPages = 1 + evaluationPages.length + photoPageCount + detailPages.length + 1;
  let pageNo = 0;
  const nextPage = () => ++pageNo;

  return (
    <>
      <UnifiedPage caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
        <StandardDocumentHeader
          title="工事完了報告書"
          eyebrow="CONSTRUCTION COMPLETION REPORT"
          storeName={formatLabel(caseData.storeName)}
          leadText="下記のとおり工事を完了いたしましたので、ご報告申し上げます。"
          requestNumber={formatDigits(caseData.requestNumber)}
          reportDate={formatDate(issuedAt)}
          status={formatLabel(content.statusBadge || "施工完了")}
        />
        <StandardSectionBand>工事完了サマリー</StandardSectionBand>
        <CompletionStatus label={formatLabel(content.statusBadge || "施工完了・確認済み")} />
        <table className="mb-4 w-full table-fixed border-collapse">
          <colgroup><col className="w-[18%]" /><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[32%]" /></colgroup>
          <tbody>
            <tr><StandardReportTh>ブランド</StandardReportTh><StandardReportTd>{formatLabel(caseData.brand)}</StandardReportTd><StandardReportTh>店舗名</StandardReportTh><StandardReportTd>{formatLabel(caseData.storeName)}</StandardReportTd></tr>
            <tr><StandardReportTh>所在地</StandardReportTh><StandardReportTd colSpan={3}>{formatLabel(caseData.address) || "—"}</StandardReportTd></tr>
            <tr><StandardReportTh>工事名</StandardReportTh><StandardReportTd colSpan={3}>{formatLabel(workName)}</StandardReportTd></tr>
            <tr><StandardReportTh>施工日</StandardReportTh><StandardReportTd>{formatDate(caseData.constructionDate)}</StandardReportTd><StandardReportTh>完了日</StandardReportTh><StandardReportTd>{formatDate(completedAt)}</StandardReportTd></tr>
            <tr><StandardReportTh>施工会社</StandardReportTh><StandardReportTd colSpan={3}>{formatLabel(caseData.contractorName) || "—"}</StandardReportTd></tr>
          </tbody>
        </table>
        <StandardSectionBand>工事概要</StandardSectionBand>
        <div className="border border-[#cbd5e1] bg-[#fbfcfd] px-4 py-3">
          <BodyText>{formatLabel(content.overview || caseData.requestContent || "工事内容は未入力です。")}</BodyText>
        </div>
        {content.purpose.trim() && <><StandardSectionBand>施工目的</StandardSectionBand><BodyText>{formatLabel(content.purpose)}</BodyText></>}
      </UnifiedPage>

      {evaluationPages.map((rows, evaluationPageIndex) => (
        <UnifiedPage key={`evaluation-${evaluationPageIndex}`} caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
          <div className="mb-4 border-b-2 border-[#17324d] pb-2">
            <h2 className="font-serif-jp text-[16px] font-semibold text-[#17324d]">工事範囲・総評</h2>
            <p className="mt-1 text-[9px] text-[#667085]">案件番号：{formatDigits(caseData.requestNumber)}</p>
          </div>
          {evaluationPageIndex === 0 && (
            <>
              <StandardSectionBand>工事範囲</StandardSectionBand>
              <BodyText>{formatLabel(content.scope || caseData.requestContent || "—")}</BodyText>
              <StandardSectionBand>工事総評</StandardSectionBand>
              <div className="border border-[#9ed4b1] bg-[#edf8f1] px-4 py-3"><BodyText>{formatLabel(content.summary || "総評は未入力です。")}</BodyText></div>
            </>
          )}
          {rows.length > 0 && <><StandardSectionBand>{evaluationPageIndex === 0 ? "施工前後の状態評価" : "施工前後の状態評価（続き）"}</StandardSectionBand><EvaluationTable rows={rows} formatLabel={formatLabel} /></>}
        </UnifiedPage>
      ))}

      {hasAnyPhoto ? (
        <>
          {comparisonPages.map((pairs, comparisonPageIndex) => (
            <UnifiedPage key={`comparison-${comparisonPageIndex}`} caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
              <StandardSectionBand aside={`比較 ${formatDigits(comparisonPageIndex + 1)} / ${formatDigits(comparisonPages.length)}`}>施工前／施工後 写真比較</StandardSectionBand>
              <div className="space-y-4">
                {pairs.map((pair, pairIndex) => (
                  <section key={`${pair.before?.id ?? "none"}-${pair.after?.id ?? "none"}`} data-before-after-pair="true">
                    <div className="mb-2 flex items-center justify-between border-b border-[#cbd5e1] pb-1.5">
                      <h3 className="font-serif-jp text-[11px] font-semibold text-[#17324d]">工事項目 {formatDigits(comparisonPageIndex * 2 + pairIndex + 1)}｜{formatLabel(pair.workItem)}</h3>
                      <span className="text-[8.5px] text-[#667085]">登録写真のみ掲載</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EvidencePhoto photo={pair.before} label="BEFORE｜施工前" caption={pair.before ? captionMap.get(pair.before.id) : undefined} color="before" formatLabel={formatLabel} />
                      <EvidencePhoto photo={pair.after} label="AFTER｜施工後" caption={pair.after ? captionMap.get(pair.after.id) : undefined} color="after" formatLabel={formatLabel} />
                    </div>
                  </section>
                ))}
              </div>
            </UnifiedPage>
          ))}
          {processPages.map((photos, processPageIndex) => (
            <UnifiedPage key={`process-${processPageIndex}`} caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
              <StandardSectionBand aside={`施工中 ${formatDigits(processPageIndex + 1)} / ${formatDigits(processPages.length)}`}>施工中写真</StandardSectionBand>
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => <ProcessPhoto key={photo.id} photo={photo} caption={captionMap.get(photo.id)} formatLabel={formatLabel} />)}
              </div>
            </UnifiedPage>
          ))}
        </>
      ) : (
        <UnifiedPage caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
          <StandardSectionBand>施工写真</StandardSectionBand>
          <div className="mt-8 border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 py-12 text-center text-[11px] leading-relaxed text-[#667085]">
            施工前・施工後・施工中の写真は登録されていません。<br />写真がない場合も、存在しない写真は生成せずこの状態で出力します。
          </div>
        </UnifiedPage>
      )}

      {detailPages.map((sections, detailPageIndex) => (
        <UnifiedPage key={`details-${detailPageIndex}`} caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
          <div className="mb-4 border-b-2 border-[#17324d] pb-2"><h2 className="font-serif-jp text-[16px] font-semibold text-[#17324d]">施工詳細・保全情報</h2></div>
          {sections}
        </UnifiedPage>
      ))}

      <UnifiedPage caseData={caseData} pageNo={nextPage()} totalPages={totalPages} formatDigits={formatDigits}>
        <div className="mb-4 border-b-2 border-[#17324d] pb-2">
          <h2 className="font-serif-jp text-[16px] font-semibold text-[#17324d]">最終確認</h2>
          <p className="mt-1 text-[9px] text-[#667085]">{formatLabel(workName)}｜完了日 {formatDate(completedAt)}</p>
        </div>
        <StandardSectionBand>完了確認</StandardSectionBand>
        <div className="grid grid-cols-3 gap-3">
          <div className="border-t-[3px] border-[#1e8449] bg-[#f6fbf8] px-3 py-3"><p className="text-[9px] text-[#667085]">施工</p><p className="mt-1 text-[13px] font-bold text-[#155c37]">対象範囲完了</p></div>
          <div className="border-t-[3px] border-[#1e8449] bg-[#f6fbf8] px-3 py-3"><p className="text-[9px] text-[#667085]">清掃・養生</p><p className="mt-1 text-[13px] font-bold text-[#155c37]">完了確認</p></div>
          <div className="border-t-[3px] border-[#d19a28] bg-[#fffaf0] px-3 py-3"><p className="text-[9px] text-[#667085]">経過確認</p><p className="mt-1 text-[13px] font-bold text-[#8a5a00]">点検計画を参照</p></div>
        </div>
        <div className="mt-5 border border-[#9ed4b1] bg-[#edf8f1] px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold text-[#155c37]">工事完了結論</p>
          <BodyText>{formatLabel(content.conclusion || content.summary || "対象範囲の工事完了をご確認ください。")}</BodyText>
        </div>
        <div className="mt-8">
          <StandardSignatureBlock signature={signature} secondarySignature={customerSignature} />
        </div>
      </UnifiedPage>
    </>
  );
}
