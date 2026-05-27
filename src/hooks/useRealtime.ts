import { useEffect } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../lib/socket';
import type { Notification } from './useNotifications';

type NotificationEvent = Notification & {
  readAt?: string | null;
  channel?: string;
  unreadCount?: number;
};

type NotificationReadEvent = {
  id: string;
  isRead?: boolean;
  readAt?: string | null;
  unreadCount?: number;
};

type RecordEvent = {
  id?: string;
  organizationId?: string | null;
  action?: string;
};

function setUnreadCount(queryClient: QueryClient, count: number | undefined) {
  if (typeof count === 'number') {
    queryClient.setQueryData(['notifications', 'unread-count'], count);
  }
}
function updateNotificationQueries(
  queryClient: QueryClient,
  updater: (old: any, queryKey: readonly unknown[]) => any,
) {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: ['notifications'] })
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (old: any) => updater(old, query.queryKey));
    });
}

function shouldShowNewNotification(queryKey: readonly unknown[], payload: NotificationEvent) {
  const filter = queryKey.length >= 3 && typeof queryKey[2] === 'string' ? queryKey[2] : 'all';
  if (filter === 'read') return Boolean(payload.isRead);
  if (filter === 'unread') return !payload.isRead;
  return true;
}

function prependNotification(queryClient: QueryClient, payload: NotificationEvent) {
  setUnreadCount(queryClient, payload.unreadCount);
  updateNotificationQueries(queryClient, (old, queryKey) => {
    const notifications = old?.data?.notifications;
    if (!Array.isArray(notifications) || !shouldShowNewNotification(queryKey, payload)) return old;
    const next = [payload, ...notifications.filter((item: Notification) => item.id !== payload.id)];
    return {
      ...old,
      data: {
        ...old.data,
        notifications: next.slice(0, Math.max(notifications.length, 20)),
        unreadCount: payload.unreadCount ?? old.data.unreadCount,
      },
    };
  });
}

function markNotificationRead(queryClient: QueryClient, payload: NotificationReadEvent) {
  setUnreadCount(queryClient, payload.unreadCount);
  updateNotificationQueries(queryClient, (old, queryKey) => {
    const notifications = old?.data?.notifications;
    if (!Array.isArray(notifications)) return old;
    const filter = queryKey.length >= 3 && typeof queryKey[2] === 'string' ? queryKey[2] : 'all';
    const next = notifications
      .map((item: Notification) =>
        item.id === payload.id
          ? { ...item, isRead: true, readAt: payload.readAt ?? (item as any).readAt ?? null }
          : item,
      )
      .filter((item: Notification) => filter !== 'unread' || !item.isRead);
    return {
      ...old,
      data: {
        ...old.data,
        notifications: next,
        unreadCount: payload.unreadCount ?? old.data.unreadCount,
      },
    };
  });
}

function markAllNotificationsRead(queryClient: QueryClient) {
  setUnreadCount(queryClient, 0);
  updateNotificationQueries(queryClient, (old, queryKey) => {
    const notifications = old?.data?.notifications;
    if (!Array.isArray(notifications)) return old;
    const filter = queryKey.length >= 3 && typeof queryKey[2] === 'string' ? queryKey[2] : 'all';
    return {
      ...old,
      data: {
        ...old.data,
        notifications:
          filter === 'unread'
            ? []
            : notifications.map((item: Notification) => ({ ...item, isRead: true })),
        unreadCount: 0,
      },
    };
  });
}

function invalidateRecordQueries(queryClient: QueryClient, resource: string, data?: RecordEvent) {
  const detailId = data?.id;
  const dashboardResources = new Set(['incident', 'problem', 'change', 'service_request', 'alert', 'asset']);
  if (dashboardResources.has(resource)) {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  if (resource === 'incident') {
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['incidents', 'detail', detailId] });
    return;
  }
  if (resource === 'problem') {
    queryClient.invalidateQueries({ queryKey: ['problems'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['problems', 'detail', detailId] });
    return;
  }
  if (resource === 'change') {
    queryClient.invalidateQueries({ queryKey: ['changes'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['changes', 'detail', detailId] });
    return;
  }
  if (resource === 'service_request') {
    queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['serviceRequests', 'detail', detailId] });
    return;
  }
  if (resource === 'alert') {
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    return;
  }
  if (resource === 'asset') {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    return;
  }
  if (resource === 'learning') {
    queryClient.invalidateQueries({ queryKey: ['learning'] });
  }
}

export function useRealtime() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onNotificationNew = (payload: NotificationEvent) => {
      prependNotification(queryClient, payload);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onNotificationRead = (payload: NotificationReadEvent) => {
      markNotificationRead(queryClient, payload);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onNotificationsReadAll = () => {
      markAllNotificationsRead(queryClient);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const onIncident = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'incident', data);
    const onProblem = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'problem', data);
    const onChange = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'change', data);
    const onServiceRequest = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'service_request', data);
    const onAlert = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'alert', data);
    const onAsset = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'asset', data);
    const onLearning = (data?: RecordEvent) => invalidateRecordQueries(queryClient, 'learning', data);
    const onVoiceCall = () => {
      invalidateRecordQueries(queryClient, 'incident');
      queryClient.invalidateQueries({ queryKey: ['voice'] });
    };

    socket.on('notification:new', onNotificationNew);
    socket.on('notification:read', onNotificationRead);
    socket.on('notifications:read-all', onNotificationsReadAll);

    socket.on('incident:created', onIncident);
    socket.on('incident:updated', onIncident);
    socket.on('problem:created', onProblem);
    socket.on('problem:updated', onProblem);
    socket.on('change:created', onChange);
    socket.on('change:updated', onChange);
    socket.on('service_request:created', onServiceRequest);
    socket.on('service_request:updated', onServiceRequest);
    socket.on('alert:fired', onAlert);
    socket.on('alert:resolved', onAlert);
    socket.on('alert:acknowledged', onAlert);
    socket.on('asset:updated', onAsset);
    socket.on('learning:updated', onLearning);
    socket.on('voice:call-completed', onVoiceCall);

    return () => {
      socket.off('notification:new', onNotificationNew);
      socket.off('notification:read', onNotificationRead);
      socket.off('notifications:read-all', onNotificationsReadAll);
      socket.off('incident:created', onIncident);
      socket.off('incident:updated', onIncident);
      socket.off('problem:created', onProblem);
      socket.off('problem:updated', onProblem);
      socket.off('change:created', onChange);
      socket.off('change:updated', onChange);
      socket.off('service_request:created', onServiceRequest);
      socket.off('service_request:updated', onServiceRequest);
      socket.off('alert:fired', onAlert);
      socket.off('alert:resolved', onAlert);
      socket.off('alert:acknowledged', onAlert);
      socket.off('asset:updated', onAsset);
      socket.off('learning:updated', onLearning);
      socket.off('voice:call-completed', onVoiceCall);
    };
  }, [socket, queryClient]);
}
