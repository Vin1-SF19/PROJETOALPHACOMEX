'use client';

import { useChecklistNotifications } from '@/hooks/useChecklistNotifications';
import ChecklistNotificationCenter from './ChecklistNotificationCenter';

interface Props {
  role: string;
}

export default function ChecklistNotificacoesWidget({ role }: Props) {
  useChecklistNotifications(role);
  return <ChecklistNotificationCenter />;
}
