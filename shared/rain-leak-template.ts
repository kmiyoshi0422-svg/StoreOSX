/**
 * 雨漏り調査チェック項目テンプレート
 * Excelの「02_室内チェック」「03_天井裏チェック」「04_外部チェック」に対応
 */

export type RainLeakTemplateItem = {
  section: "室内" | "天井裏" | "外部";
  orderNo: number;
  category: string;
  itemTitle: string;
};

export const RAIN_LEAK_CHECKLIST_TEMPLATE: RainLeakTemplateItem[] = [
  // 室内チェック（17項目）
  { section: "室内", orderNo: 1, category: "天井", itemTitle: "天井の変色・シミ" },
  { section: "室内", orderNo: 2, category: "天井", itemTitle: "天井のふくらみ・垂れ下がり" },
  { section: "室内", orderNo: 3, category: "天井", itemTitle: "天井裏からの水滴落下" },
  { section: "室内", orderNo: 4, category: "壁", itemTitle: "壁紙の剥がれ・浮き" },
  { section: "室内", orderNo: 5, category: "壁", itemTitle: "壁の変色・シミ" },
  { section: "室内", orderNo: 6, category: "壁", itemTitle: "クロスのカビ発生" },
  { section: "室内", orderNo: 7, category: "窓", itemTitle: "窓枠・サッシ周りの水跡" },
  { section: "室内", orderNo: 8, category: "窓", itemTitle: "サッシ内側の結露以外の水溜まり" },
  { section: "室内", orderNo: 9, category: "床", itemTitle: "床の変色・膨れ" },
  { section: "室内", orderNo: 10, category: "床", itemTitle: "フローリングの浮き・反り" },
  { section: "室内", orderNo: 11, category: "環境", itemTitle: "カビ臭・湿った臭い" },
  { section: "室内", orderNo: 12, category: "環境", itemTitle: "室内湿度の異常な高さ" },
  { section: "室内", orderNo: 13, category: "木部", itemTitle: "木部の腐食・変色" },
  { section: "室内", orderNo: 14, category: "木部", itemTitle: "梁・柱の水染み跡" },
  { section: "室内", orderNo: 15, category: "設備", itemTitle: "電気設備の異常（照明・コンセント）" },
  { section: "室内", orderNo: 16, category: "設備", itemTitle: "分電盤への浸水痕" },
  { section: "室内", orderNo: 17, category: "設備", itemTitle: "エアコン配管周りの水跡" },

  // 天井裏チェック（15項目）
  { section: "天井裏", orderNo: 1, category: "野地板", itemTitle: "野地板のシミ・変色" },
  { section: "天井裏", orderNo: 2, category: "野地板", itemTitle: "野地板の腐食・剥離" },
  { section: "天井裏", orderNo: 3, category: "構造材", itemTitle: "垂木の濡れ跡" },
  { section: "天井裏", orderNo: 4, category: "構造材", itemTitle: "梁の水染み" },
  { section: "天井裏", orderNo: 5, category: "構造材", itemTitle: "母屋・棟木の腐食" },
  { section: "天井裏", orderNo: 6, category: "断熱材", itemTitle: "断熱材の湿り・変色" },
  { section: "天井裏", orderNo: 7, category: "断熱材", itemTitle: "断熱材の落下・ズレ" },
  { section: "天井裏", orderNo: 8, category: "痕跡", itemTitle: "白い結晶（エフロレッセンス）" },
  { section: "天井裏", orderNo: 9, category: "痕跡", itemTitle: "水滴の付着" },
  { section: "天井裏", orderNo: 10, category: "痕跡", itemTitle: "水が流れた跡（筋状のシミ）" },
  { section: "天井裏", orderNo: 11, category: "生物", itemTitle: "蟻道・シロアリ痕" },
  { section: "天井裏", orderNo: 12, category: "生物", itemTitle: "動物侵入痕（糞・巣）" },
  { section: "天井裏", orderNo: 13, category: "光", itemTitle: "光が漏れて見える箇所（穴・隙間）" },
  { section: "天井裏", orderNo: 14, category: "換気", itemTitle: "換気不良による結露痕" },
  { section: "天井裏", orderNo: 15, category: "配線", itemTitle: "電気配線周りの湿気・腐食" },

  // 外部チェック（24項目）
  { section: "外部", orderNo: 1, category: "屋根", itemTitle: "瓦のズレ・割れ・欠け" },
  { section: "外部", orderNo: 2, category: "屋根", itemTitle: "スレートの浮き・欠損" },
  { section: "外部", orderNo: 3, category: "屋根", itemTitle: "棟板金の浮き・釘抜け" },
  { section: "外部", orderNo: 4, category: "屋根", itemTitle: "コケ・カビの繁殖" },
  { section: "外部", orderNo: 5, category: "屋根", itemTitle: "屋根塗装の剥離・退色" },
  { section: "外部", orderNo: 6, category: "屋根", itemTitle: "谷樋の錆・穴あき" },
  { section: "外部", orderNo: 7, category: "雨樋", itemTitle: "雨樋の詰まり（落ち葉等）" },
  { section: "外部", orderNo: 8, category: "雨樋", itemTitle: "雨樋の割れ・外れ" },
  { section: "外部", orderNo: 9, category: "雨樋", itemTitle: "集水器・竪樋のあふれ" },
  { section: "外部", orderNo: 10, category: "雨樋", itemTitle: "軒樋の勾配異常" },
  { section: "外部", orderNo: 11, category: "外壁", itemTitle: "外壁のクラック（0.3mm未満）" },
  { section: "外部", orderNo: 12, category: "外壁", itemTitle: "外壁のクラック（0.3mm以上）" },
  { section: "外部", orderNo: 13, category: "外壁", itemTitle: "外壁塗装の劣化・チョーキング" },
  { section: "外部", orderNo: 14, category: "外壁", itemTitle: "外壁材の反り・浮き" },
  { section: "外部", orderNo: 15, category: "目地", itemTitle: "コーキング（目地）の劣化・剥離" },
  { section: "外部", orderNo: 16, category: "目地", itemTitle: "サッシ廻りコーキング切れ" },
  { section: "外部", orderNo: 17, category: "開口部", itemTitle: "換気口・配管貫通部の隙間" },
  { section: "外部", orderNo: 18, category: "開口部", itemTitle: "エアコン配管貫通部の劣化" },
  { section: "外部", orderNo: 19, category: "ベランダ", itemTitle: "ベランダ防水層の劣化・膨れ" },
  { section: "外部", orderNo: 20, category: "ベランダ", itemTitle: "ベランダ排水口の詰まり" },
  { section: "外部", orderNo: 21, category: "ベランダ", itemTitle: "ベランダ立ち上がり部の亀裂" },
  { section: "外部", orderNo: 22, category: "笠木", itemTitle: "笠木（手すり天端）の浮き" },
  { section: "外部", orderNo: 23, category: "笠木", itemTitle: "笠木ジョイント部のシール切れ" },
  { section: "外部", orderNo: 24, category: "基礎", itemTitle: "基礎コンクリートのクラック" },
];

/**
 * 浸入経路推定マトリクス
 */
export const ROUTE_ESTIMATION_MATRIX = [
  { location: "天井中央", suspect1: "屋根本体", suspect2: "天窓", suspect3: "配管貫通部" },
  { location: "天井の端（外壁側）", suspect1: "外壁クラック", suspect2: "サッシ上部", suspect3: "雨樋オーバーフロー" },
  { location: "窓の上・横", suspect1: "サッシ廻りコーキング", suspect2: "外壁クラック", suspect3: "水切り不良" },
  { location: "1階天井のみ", suspect1: "2階ベランダ防水", suspect2: "2階配管漏水", suspect3: "2階窓周り" },
  { location: "最上階の壁", suspect1: "外壁劣化", suspect2: "笠木・パラペット", suspect3: "屋根と外壁の取合" },
  { location: "階段室・吹抜", suspect1: "上部窓周り", suspect2: "屋根トップライト", suspect3: "換気塔・煙突" },
  { location: "玄関・軒下", suspect1: "軒天ボード劣化", suspect2: "破風板の腐食", suspect3: "雨樋あふれ" },
];
