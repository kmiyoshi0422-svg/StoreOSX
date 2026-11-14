import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { resolveOfficerName } from '@shared/responsibilityRoster';
export function useResponsibilityDirectory() {
  const {user} = useAuth();
  const query = trpc.responsibility.directory.useQuery(undefined, {enabled:!!user && user.role !== 'customer',staleTime:30_000,refetchInterval:60_000});
  const directory = query.data ?? [];
  return {directory,officers:directory.filter(member => member.active),officerName:(key:string|null|undefined)=>resolveOfficerName(key,directory),isLoading:query.isLoading,error:query.error};
}
