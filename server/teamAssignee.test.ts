import { describe, it, expect } from "vitest";
import {
  buildTeamMemberIdSet,
  filterAssigneeOptions,
} from "../shared/teamAssignee";

const USERS = [
  { id: 1, name: "三好慶" },
  { id: 2, name: "野口直人" },
  { id: 3, name: "隅野柊弥" },
  { id: 4, name: "新藤雅樹" },
];

describe("buildTeamMemberIdSet", () => {
  it("代表担当者とメンバーを統合した集合を返す", () => {
    const set = buildTeamMemberIdSet({ primaryUserId: 1, memberIds: [2, 3] });
    expect([...set].sort()).toEqual([1, 2, 3]);
  });

  it("代表担当者は重複してもメンバーに含まれる（重複しない）", () => {
    const set = buildTeamMemberIdSet({ primaryUserId: 2, memberIds: [2, 3] });
    expect([...set].sort()).toEqual([2, 3]);
  });

  it("primaryもmemberIdsも無い場合は空集合", () => {
    expect(buildTeamMemberIdSet({ primaryUserId: null }).size).toBe(0);
    expect(buildTeamMemberIdSet(undefined).size).toBe(0);
    expect(buildTeamMemberIdSet(null).size).toBe(0);
  });
});

describe("filterAssigneeOptions", () => {
  it("メンバー未設定（空集合）なら全ユーザーを返す", () => {
    const result = filterAssigneeOptions(USERS, new Set(), null);
    expect(result).toEqual(USERS);
  });

  it("メンバー設定済みならメンバーのみに絞る", () => {
    const result = filterAssigneeOptions(USERS, new Set([1, 3]), null);
    expect(result.map((u) => u.id)).toEqual([1, 3]);
  });

  it("現担当がメンバー外なら末尾に残す（旧データ救済）", () => {
    const result = filterAssigneeOptions(USERS, new Set([1, 3]), 2);
    expect(result.map((u) => u.id)).toEqual([1, 3, 2]);
  });

  it("現担当がメンバー内なら重複追加しない", () => {
    const result = filterAssigneeOptions(USERS, new Set([1, 3]), 1);
    expect(result.map((u) => u.id)).toEqual([1, 3]);
  });

  it("現担当がnullなら絞り込みのみ", () => {
    const result = filterAssigneeOptions(USERS, new Set([4]), null);
    expect(result.map((u) => u.id)).toEqual([4]);
  });

  it("現担当が存在しないIDでも落ちない", () => {
    const result = filterAssigneeOptions(USERS, new Set([1]), 999);
    expect(result.map((u) => u.id)).toEqual([1]);
  });
});
