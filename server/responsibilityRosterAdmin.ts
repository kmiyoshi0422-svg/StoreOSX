import { desc, eq, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { appSettings, users, responsibilityRosterLogs } from '../drizzle/schema';
import { getDb } from './db';
import { protectedProcedure } from './_core/trpc';
import { canManageCases } from '../shared/accessPolicy';
import { OFFICER_ROSTER_SETTING, type OfficerMember, type OfficerRoster } from '../shared/responsibilityRoster';
import { loadOfficerRoster, hydrateOfficerIdentities } from './responsibilityRosterStore';
export const rosterAdminProcedures = {
  rosterManagement: protectedProcedure.query(async ({ctx}) => {
    if (ctx.user.role !== 'owner') throw new TRPCError({code:'FORBIDDEN',message:'責任者メンバー管理は最高管理者専用です'});
    const db = await getDb(); if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const roster = await loadOfficerRoster(db);
    const candidates = (await db.select().from(users)).filter(user => !user.disabledAt && canManageCases(user.role))
      .map(user => ({id:user.id,name:user.nameOverride || [...roster.current,...roster.archived].find(member=>member.userIds.includes(user.id))?.name || user.name || `User #${user.id}`,email:user.email,role:user.role}));
    const current = roster.current.map(member => ({...member,eligible:member.userIds.some(id => candidates.some(user => user.id === id))}));
    const history = await db.select().from(responsibilityRosterLogs).orderBy(desc(responsibilityRosterLogs.id)).limit(50);
    return {...roster,current,candidates,history};
  }),
  replaceRoster: protectedProcedure.input(z.object({expectedVersion:z.number().int().nonnegative(),members:z.array(z.number().int().positive()).length(5),reason:z.string().trim().min(1).max(500)}))
    .mutation(async ({ctx,input}) => {
      if (ctx.user.role !== 'owner') throw new TRPCError({code:'FORBIDDEN',message:'責任者メンバーの入替は最高管理者専用です'});
      if (new Set(input.members).size !== 5) throw new TRPCError({code:'BAD_REQUEST',message:'重複のない5名を選択してください'});
      const db = await getDb(); if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
      return db.transaction(async tx => {
        const initial = await loadOfficerRoster(tx);
        await tx.insert(appSettings).values({settingKey:OFFICER_ROSTER_SETTING,settingValue:JSON.stringify(initial)})
          .onDuplicateKeyUpdate({set:{settingKey:OFFICER_ROSTER_SETTING}});
        const [locked] = await tx.select().from(appSettings).where(eq(appSettings.settingKey,OFFICER_ROSTER_SETTING)).for('update');
        const before = await hydrateOfficerIdentities(tx,JSON.parse(locked.settingValue) as OfficerRoster);
        if (before.version !== input.expectedVersion) throw new TRPCError({code:'CONFLICT',message:'他の画面でメンバーが変更されました。再取得して確認してください。変更は行っていません'});
        const people = await tx.select().from(users).where(inArray(users.id,input.members)).orderBy(users.id).for('update');
        if (people.length !== 5 || people.some(user => user.disabledAt || !canManageCases(user.role)))
          throw new TRPCError({code:'BAD_REQUEST',message:'在籍中の社員・管理者・役員・最高管理者から5名を選択してください'});
        const emails = people.map(user => user.email?.trim().toLowerCase()).filter(Boolean);
        if (new Set(emails).size !== emails.length) throw new TRPCError({code:'BAD_REQUEST',message:'同じメールの複数アカウントを別々の責任者として登録できません'});
        const current: OfficerMember[] = input.members.map(id => {
          const user = people.find(person => person.id === id)!;
          const known = [...before.current,...before.archived].find(member => member.userIds.includes(id));
          return known ? {...known,userId:id,name:user.nameOverride || known.name} : {key:`member_${id}`,name:user.nameOverride || user.name || `User #${id}`,userId:id,userIds:[id]};
        });
        if (new Set(current.map(member => member.key)).size !== 5) throw new TRPCError({code:'BAD_REQUEST',message:'同じ本人の別アカウントが含まれています。異なる5名を選択してください'});
        const activeKeys = new Set(current.map(member => member.key));
        const archived = [...before.archived,...before.current.filter(member => !activeKeys.has(member.key))].filter(member => !activeKeys.has(member.key));
        const after: OfficerRoster = {version:before.version+1,current,archived:Array.from(new Map(archived.map(member => [member.key,member])).values())};
        await tx.update(appSettings).set({settingValue:JSON.stringify(after)}).where(eq(appSettings.id,locked.id));
        await tx.insert(responsibilityRosterLogs).values({beforeJson:JSON.stringify(before),afterJson:JSON.stringify(after),reason:input.reason,changedBy:ctx.user.id,changedByName:ctx.user.name ?? `User #${ctx.user.id}`});
        return {success:true as const,version:after.version};
      });
    }),
};
