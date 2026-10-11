import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
describe('専用完了期限のUI・API契約', () => {
  it('社内詳細だけに専用期限入力を設置し、解除確認・理由・保存中を表示', () => {
    const detail=fs.readFileSync('client/src/pages/CaseDetail.tsx','utf8');
    const editor=fs.readFileSync('client/src/components/CompletionDeadlineCard.tsx','utf8');
    expect(detail).toContain('canManageCase && <CompletionDeadlineCard');
    for(const text of ['完了期限の日付','完了期限の変更理由','expectedDeadline: current','完了期限を解除しますか','保存中…','完了期限の変更履歴'])expect(editor).toContain(text);
  });
  it('自社担当データだけを使い、個人タブと業者ホームに期限強調を接続', () => {
    const page=fs.readFileSync('client/src/pages/MyCases.tsx','utf8'), home=fs.readFileSync('client/src/pages/Home.tsx','utf8'), dashboard=fs.readFileSync('client/src/components/PartnerDeadlineDashboard.tsx','utf8');
    expect(page).toContain("assignmentKind === 'partner' && <PartnerDeadlineSummary");
    expect(page).toContain('data-deadline-state'); expect(home).toContain('<PartnerDeadlineDashboard />');
    expect(dashboard).toContain('trpc.responsibility.personal.useQuery'); expect(dashboard).toContain("['soon', 'today', 'overdue']"); expect(dashboard).toContain('refetchInterval: 60_000');
  });
  it('通常案件更新経路と社外全案件DTOへ期限を出さない', () => {
    const server=fs.readFileSync('server/routers.ts','utf8');
    expect(server).toContain('result.completionDeadline = null');
    expect(server).toContain('完了期限は専用の入力欄から変更してください');
  });
});
