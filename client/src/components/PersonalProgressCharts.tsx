import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { CASE_STATUSES, PROGRESS_STAGES } from '@shared/stageStatus';

const COLORS = ['#64748b', '#d97706', '#2563eb', '#7c3aed', '#ea580c', '#059669', '#71717a', '#e11d48'];
function BreakdownChart({ title, counts, order, onSelect }: {
  title: string; counts: Record<string, number>; order: readonly string[]; onSelect: (name: string) => void;
}) {
  const names = [...order, ...Object.keys(counts).filter(name => !order.includes(name))];
  const data = names.filter(name => (counts[name] ?? 0) > 0).map((name, index) => ({ name, value: counts[name], color: COLORS[names.indexOf(name) % COLORS.length] }));
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return <Card className="shadow-none" aria-label={`${title}の円グラフ`}><CardContent className="p-4">
    <h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs text-muted-foreground">現在の検索結果 {total}件。凡例を押すと絞り込めます。</p>
    {total ? <div className="grid gap-4 sm:grid-cols-2 items-center">
      <div className="relative h-[220px] min-w-0" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={data.length > 1 ? 2 : 0} isAnimationActive={false} onClick={row => onSelect(row.name)}>{data.map(row => <Cell key={row.name} fill={row.color} cursor="pointer" />)}</Pie><Tooltip formatter={(value: number) => [`${value}件 (${(value / total * 100).toFixed(1)}%)`, '件数']} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-2xl font-semibold">{total}</span><span className="text-xs text-muted-foreground">件</span></div></div>
      <div className="space-y-1" aria-label={`${title}の件数と割合`}>{data.map(row => <button type="button" key={row.name} onClick={() => onSelect(row.name)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /><span className="flex-1">{row.name}</span><span className="font-mono">{row.value}件</span><span className="w-12 text-right text-muted-foreground">{(row.value / total * 100).toFixed(1)}%</span></button>)}</div>
    </div> : <p className="py-10 text-center text-sm text-muted-foreground">該当案件がないため円グラフは表示しません。</p>}
  </CardContent></Card>;
}
export function PersonalProgressCharts({ byStatus, byStage, onStatus, onStage }: {
  byStatus: Record<string, number>; byStage: Record<string, number>; onStatus: (status: string) => void; onStage: (stage: string) => void;
}) {
  return <div className="grid gap-3 lg:grid-cols-2"><BreakdownChart title="ステータス別" counts={byStatus} order={CASE_STATUSES} onSelect={onStatus} /><BreakdownChart title="進捗別" counts={byStage} order={PROGRESS_STAGES} onSelect={onStage} /></div>;
}
