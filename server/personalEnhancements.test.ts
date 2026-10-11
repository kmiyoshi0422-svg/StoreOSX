import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { deadlineInfo, deadlineLabel } from '../shared/caseDeadline';
import { summarizePersonalCases } from '../shared/caseResponsibility';
const now=Date.parse('2026-10-11T00:00:00+09:00');
describe('期限ハイライトの暦日基準',()=>{
 it.each([['2026-10-10','overdue',-1],['2026-10-11','today',0],['2026-10-12','soon',1],['2026-10-14','soon',3],['2026-10-15','normal',4]])('%sの期限判定は%s',(deadline,state,days)=>expect(deadlineInfo({status:'施工中',deadline},now)).toEqual({state,days}));
 it('UTC日付ではなくJSTの当日を使う',()=>{expect(deadlineInfo({status:'施工待ち',deadline:'2026-10-11'},Date.parse('2026-10-10T15:00:00Z')).state).toBe('today');expect(deadlineInfo({status:'施工待ち',deadline:'2026-10-11'},Date.parse('2026-10-10T14:59:59Z'))).toEqual({state:'soon',days:1});});
 it.each(['完了','クローズ','失注'])('%sは期限超過でも警告しない',status=>expect(deadlineInfo({status,deadline:'2026-10-01'},now)).toEqual({state:'closed',days:null}));
 it.each([null,undefined,'','2026-02-30','2026-13-01','2026-1-2','invalid'])('未登録／不正な期限%sを補完しない',deadline=>expect(deadlineInfo({status:'受付',deadline},now)).toEqual({state:'unset',days:null}));
 it('期限ラベルは残り日数と超過日数を区別',()=>{expect(deadlineLabel('soon',3)).toBe('期限まであと3日');expect(deadlineLabel('overdue',-2)).toBe('期限超過 2日');expect(deadlineLabel('today',0)).toBe('本日が期限');});
});
describe('担当案件の円グラフ・一括UI契約',()=>{
 it('進捗件数の合計は担当対象件数と一致し未登録進捗を未対応として数える',()=>{const summary=summarizePersonalCases([{status:'受付',urgency:'A',progressStage:null},{status:'見積中',urgency:'B',progressStage:'現調済'},{status:'施工中',urgency:'S',progressStage:'承認済'}]);expect(Object.values(summary.byStage).reduce((a,b)=>a+b,0)).toBe(summary.total);expect(Object.values(summary.byStatus).reduce((a,b)=>a+b,0)).toBe(summary.total);expect(summary.byStage['未対応']).toBe(1);});
 it('ドーナツは実件数・割合・0件・キーボード凡例を表示し検索後データを使う',()=>{const chart=fs.readFileSync('client/src/components/PersonalProgressCharts.tsx','utf8');const page=fs.readFileSync('client/src/pages/MyCases.tsx','utf8');for(const text of ['ResponsiveContainer','innerRadius','toFixed(1)','該当案件がない','<button type="button"'])expect(chart).toContain(text);expect(page).toContain('byStatus={filteredSummary.byStatus}');expect(page).toContain('byStage={filteredSummary.byStage}');expect(page).toContain('stageFilter');});
 it('一括更新は確認画面・最大100件・キャンセルと処理中で誤操作防止',()=>{const text=fs.readFileSync('client/src/components/ResponsibilityAlert.tsx','utf8');for(const phrase of ['DialogTitle','選択案件の責任者を一括割当','最大100件','キャンセル','mutation.isPending','割当中…','this impossible dummy phrase'].slice(0,-1))expect(text).toContain(phrase);});
});
