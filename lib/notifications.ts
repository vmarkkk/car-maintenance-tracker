import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { MaintenanceAlert, MAINTENANCE_LABELS } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('maintenance', {
      name: 'Maintenance Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return finalStatus;
}

export async function scheduleMaintenanceNotification(alert: MaintenanceAlert) {
  const label = alert.schedule.custom_label ?? MAINTENANCE_LABELS[alert.schedule.type];
  const carName = `${alert.car.year} ${alert.car.make} ${alert.car.model}`;

  let body = '';
  if (alert.overdue) {
    body = `${label} is overdue for your ${carName}!`;
  } else if (alert.daysUntilDue !== undefined && alert.daysUntilDue <= 14) {
    body = `${label} due in ${alert.daysUntilDue} days for your ${carName}`;
  } else if (alert.milesUntilDue !== undefined && alert.milesUntilDue <= 500) {
    body = `${label} due in ${alert.milesUntilDue} miles for your ${carName}`;
  }

  if (!body) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.overdue ? '⚠️ Overdue Maintenance' : '🔧 Upcoming Maintenance',
      body,
      data: { carId: alert.car.id, type: alert.schedule.type },
      sound: true,
    },
    trigger: null, // immediate
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
