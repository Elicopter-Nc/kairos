import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { combine, dateToTime, fromKey, toKey } from './date';

// Sélecteurs natifs Android (dialogue système), version promesse.

export function pickDate(current?: string): Promise<string | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: current ? fromKey(current) : new Date(),
      mode: 'date',
      firstDayOfWeek: 1,
      onValueChange: (_e, d) => resolve(toKey(d)),
      onDismiss: () => resolve(null),
      onError: () => resolve(null),
    });
  });
}

export function pickTime(current?: string, day?: string): Promise<string | null> {
  return new Promise((resolve) => {
    let base = new Date();
    if (current) base = combine(day ?? toKey(new Date()), current);
    else base.setMinutes(base.getMinutes() < 30 ? 30 : 60, 0, 0);
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_e, d) => resolve(dateToTime(d)),
      onDismiss: () => resolve(null),
      onError: () => resolve(null),
    });
  });
}
