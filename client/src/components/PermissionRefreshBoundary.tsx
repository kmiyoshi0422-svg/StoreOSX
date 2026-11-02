import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

/** APIは毎リクエストDBの最新権限を利用。開いたままの画面も区分変更を検知して再読込する。 */
export function PermissionRefreshBoundary({children}:{children:ReactNode}){
  const cache=useQueryClient();
  const isPublic=window.location.pathname.startsWith('/partner-view/');
  const me=trpc.auth.me.useQuery(undefined,{enabled:!isPublic,retry:false,refetchInterval:30000,refetchOnWindowFocus:true});
  const previous=useRef<string|null>(null);const [refreshing,setRefreshing]=useState(false);
  const key=me.data===undefined?undefined:me.data===null?'signed-out':JSON.stringify([me.data.id,me.data.role,me.data.areaAccessMode,me.data.allowedPrefectures]);
  useEffect(()=>{
    if(key===undefined||isPublic)return;
    if(previous.current===null){previous.current=key;return;}
    if(previous.current===key||refreshing)return;
    previous.current=key;setRefreshing(true);
    void cache.cancelQueries().finally(()=>{cache.clear();window.location.reload();});
  },[key,isPublic,cache,refreshing]);
  return refreshing?<div role="status" className="p-8 text-center">権限が変更されました。画面を更新しています…</div>:children;
}
