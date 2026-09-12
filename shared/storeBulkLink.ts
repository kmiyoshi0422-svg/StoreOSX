export type BulkLinkCase = {
  id: number;
  requestNumber: string;
  storeCode: string | null;
  storeName: string;
  brand?: string | null;
  prefecture?: string | null;
  address?: string | null;
};

export type BulkLinkStore = {
  id: number;
  storeCode: string | null;
  storeName: string;
};

export type StoreLinkCandidate = {
  caseId: number;
  requestNumber: string;
  caseStoreCode: string | null;
  caseStoreName: string;
  storeId: number;
  masterStoreCode: string | null;
  masterStoreName: string;
  matchType: "storeCode" | "storeName";
};

function normalizeCode(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").trim().replace(/[\s　]+/g, "").toLowerCase();
}

export function buildStoreBulkLinkPreview(cases: BulkLinkCase[], stores: BulkLinkStore[]) {
  const byCode = new Map<string, BulkLinkStore[]>();
  const byName = new Map<string, BulkLinkStore[]>();
  for (const store of stores) {
    const code = normalizeCode(store.storeCode);
    const name = normalizeName(store.storeName);
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), store]);
    if (name) byName.set(name, [...(byName.get(name) ?? []), store]);
  }

  const candidates: StoreLinkCandidate[] = [];
  const ambiguous: Array<BulkLinkCase & { reason: "storeCode" | "storeName"; storeIds: number[] }> = [];
  const unmatched: BulkLinkCase[] = [];

  for (const caseRow of cases) {
    const code = normalizeCode(caseRow.storeCode);
    const name = normalizeName(caseRow.storeName);
    const codeMatches = code ? byCode.get(code) ?? [] : [];
    if (codeMatches.length > 1) {
      ambiguous.push({ ...caseRow, reason: "storeCode", storeIds: codeMatches.map((item) => item.id) });
      continue;
    }
    if (codeMatches.length === 1) {
      const store = codeMatches[0];
      candidates.push({
        caseId: caseRow.id,
        requestNumber: caseRow.requestNumber,
        caseStoreCode: caseRow.storeCode,
        caseStoreName: caseRow.storeName,
        storeId: store.id,
        masterStoreCode: store.storeCode,
        masterStoreName: store.storeName,
        matchType: "storeCode",
      });
      continue;
    }

    const nameMatches = name ? byName.get(name) ?? [] : [];
    if (nameMatches.length > 1) {
      ambiguous.push({ ...caseRow, reason: "storeName", storeIds: nameMatches.map((item) => item.id) });
      continue;
    }
    if (nameMatches.length === 1) {
      const store = nameMatches[0];
      candidates.push({
        caseId: caseRow.id,
        requestNumber: caseRow.requestNumber,
        caseStoreCode: caseRow.storeCode,
        caseStoreName: caseRow.storeName,
        storeId: store.id,
        masterStoreCode: store.storeCode,
        masterStoreName: store.storeName,
        matchType: "storeName",
      });
      continue;
    }
    unmatched.push(caseRow);
  }

  const newStoreMap = new Map<string, {
    key: string;
    storeCode: string | null;
    storeName: string;
    brand: string | null;
    prefecture: string | null;
    address: string | null;
    caseIds: number[];
    requestNumbers: string[];
  }>();
  for (const caseRow of unmatched) {
    const code = normalizeCode(caseRow.storeCode);
    const name = normalizeName(caseRow.storeName);
    const key = code ? `code:${code}` : name ? `name:${name}` : "";
    if (!key) continue;
    const existing = newStoreMap.get(key);
    if (existing) {
      existing.caseIds.push(caseRow.id);
      existing.requestNumbers.push(caseRow.requestNumber);
    } else {
      newStoreMap.set(key, {
        key,
        storeCode: caseRow.storeCode?.trim() || null,
        storeName: caseRow.storeName.trim(),
        brand: caseRow.brand ?? null,
        prefecture: caseRow.prefecture ?? null,
        address: caseRow.address ?? null,
        caseIds: [caseRow.id],
        requestNumbers: [caseRow.requestNumber],
      });
    }
  }

  return { candidates, ambiguous, unmatched, newStores: Array.from(newStoreMap.values()) };
}
