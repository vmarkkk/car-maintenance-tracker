import { differenceInDays, addMonths, addDays, parseISO } from 'date-fns';
import { Car, MaintenanceLog, MaintenanceSchedule, MaintenanceAlert } from '../types';

export function computeNextDue(
  lastLog: MaintenanceLog,
  schedule: MaintenanceSchedule
): { next_due_date?: string; next_due_mileage?: number } {
  const result: { next_due_date?: string; next_due_mileage?: number } = {};

  if (schedule.interval_months) {
    const lastDate = parseISO(lastLog.date);
    result.next_due_date = addMonths(lastDate, schedule.interval_months).toISOString().split('T')[0];
  }

  if (schedule.interval_miles) {
    result.next_due_mileage = lastLog.mileage_at_service + schedule.interval_miles;
  }

  return result;
}

export function getAlertStatus(
  schedule: MaintenanceSchedule,
  car: Car
): { overdue: boolean; daysUntilDue?: number; milesUntilDue?: number } {
  const today = new Date();
  let overdue = false;
  let daysUntilDue: number | undefined;
  let milesUntilDue: number | undefined;

  if (schedule.next_due_date) {
    const dueDate = parseISO(schedule.next_due_date);
    const diff = differenceInDays(dueDate, today);
    daysUntilDue = diff;
    if (diff < 0) overdue = true;
  }

  if (schedule.next_due_mileage) {
    const diff = schedule.next_due_mileage - car.current_mileage;
    milesUntilDue = diff;
    if (diff <= 0) overdue = true;
  }

  return { overdue, daysUntilDue, milesUntilDue };
}

export function buildAlerts(
  cars: Car[],
  schedules: MaintenanceSchedule[],
  thresholdDays = 30,
  thresholdMiles = 500
): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];

  for (const schedule of schedules) {
    if (!schedule.is_active) continue;
    const car = cars.find((c) => c.id === schedule.car_id);
    if (!car) continue;

    const { overdue, daysUntilDue, milesUntilDue } = getAlertStatus(schedule, car);

    const soonByDate = daysUntilDue !== undefined && daysUntilDue <= thresholdDays;
    const soonByMiles = milesUntilDue !== undefined && milesUntilDue <= thresholdMiles;

    if (overdue || soonByDate || soonByMiles) {
      alerts.push({ schedule, car, overdue, daysUntilDue, milesUntilDue });
    }
  }

  // Sort: overdue first, then by days until due
  return alerts.sort((a, b) => {
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;
    return (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999);
  });
}
