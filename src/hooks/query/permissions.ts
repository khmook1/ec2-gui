import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  addRemoteUserGroup,
  createRemoteUser,
  deleteRemoteUser,
  getRemotePermissionOverview,
  listRemoteGroups,
  listRemoteUsers,
  removeRemoteUserGroup,
  setRemoteUserPasswordlessSudo,
} from "@/services/tauri";
import type {
  CreateRemoteUserInput,
  RemoteUser,
} from "@/types/permissions";

export function usePermissionOverviewQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.permissions(sessionKey ?? ""),
    queryFn: getRemotePermissionOverview,
    enabled: Boolean(sessionKey),
  });
}

export function useRemoteUsersQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<RemoteUser[]>({
    queryKey: queryKeys.remoteUsers(sessionKey ?? ""),
    queryFn: listRemoteUsers,
    enabled,
  });
}

export function useRemoteGroupsQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<string[]>({
    queryKey: queryKeys.remoteGroups(sessionKey ?? ""),
    queryFn: listRemoteGroups,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidatePermissionData() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return async () => {
    if (!sessionKey) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.remoteUsers(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.remoteGroups(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.permissions(sessionKey),
      }),
    ]);
  };
}

export interface UpdateUserGroupsInput {
  username: string;
  add: string[];
  remove: string[];
}

/** 그룹 추가/제거를 순차 실행한다 (usermod/gpasswd 가 /etc/group 을 동시에 쓰지 않도록). */
export function useUpdateRemoteUserGroupsMutation() {
  const invalidate = useInvalidatePermissionData();

  return useMutation({
    mutationFn: async ({ username, add, remove }: UpdateUserGroupsInput) => {
      for (const group of add) {
        await addRemoteUserGroup(username, group);
      }
      for (const group of remove) {
        await removeRemoteUserGroup(username, group);
      }
    },
    onSettled: invalidate,
  });
}

export function useSetRemoteUserPasswordlessSudoMutation() {
  const invalidate = useInvalidatePermissionData();

  return useMutation({
    mutationFn: ({
      username,
      enabled,
    }: {
      username: string;
      enabled: boolean;
    }) => setRemoteUserPasswordlessSudo(username, enabled),
    onSettled: invalidate,
  });
}

export function useCreateRemoteUserMutation() {
  const invalidate = useInvalidatePermissionData();

  return useMutation({
    mutationFn: (input: CreateRemoteUserInput) => createRemoteUser(input),
    onSettled: invalidate,
  });
}

export function useDeleteRemoteUserMutation() {
  const invalidate = useInvalidatePermissionData();

  return useMutation({
    mutationFn: ({
      username,
      removeHome,
    }: {
      username: string;
      removeHome: boolean;
    }) => deleteRemoteUser(username, removeHome),
    onSettled: invalidate,
  });
}
