/**
 * FCM `data.type` payload — app should open this screen when the user taps the notification.
 * Keep `value` stable for Flutter/Android/iOS routing.
 */
export const PUSH_NOTIFICATION_DESTINATIONS = [
  { value: 'home', label: 'Home screen' },
  { value: 'tournament_started', label: 'Tournament — Started page' },
  { value: 'dares', label: 'Dares' },
  { value: 'inventory_board', label: 'Inventory — Board' },
  { value: 'inventory_token', label: 'Inventory — Token' },
  { value: 'store', label: 'Store' },
  { value: 'spin_wheel', label: 'Spin the wheel' },
];

export const DEFAULT_PUSH_DESTINATION = 'home';
