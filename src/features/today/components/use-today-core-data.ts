import { useEffect, useState } from "react";

import { dateInTimezone, localIsoDate } from "./today-dates";
import { loadTodayProfileItems } from "./load-today-profile-items";
import { loadTodayWeather, todayWeatherErrorMessage } from "./load-today-weather";
import type { TodayItem, TodayProfile, WeatherView } from "./today.types";

export function useTodayCoreData(reloadVersion: number) {
  const [profile, setProfile] = useState<TodayProfile | null>(null);
  const [today, setToday] = useState(localIsoDate);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [weather, setWeather] = useState<WeatherView | null>(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      const {
        profile: nextProfile,
        items: nextItems,
        itemCount: nextCount,
        errors,
      } = await loadTodayProfileItems(controller.signal);
      if (!active) return;
      const nextDate = dateInTimezone(nextProfile?.timezone ?? "UTC");
      setProfile(nextProfile);
      setToday(nextDate);
      setItems(nextItems);
      setItemCount(nextCount);
      setCoreError(errors.length ? errors.join(" ") : null);
      setCoreLoading(false);

      try {
        setWeather(await loadTodayWeather(nextDate, controller.signal));
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setWeather(null);
        setWeatherError(todayWeatherErrorMessage(caught));
      } finally {
        if (active) setWeatherLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadVersion]);

  return {
    profile,
    today,
    items,
    itemCount,
    weather,
    coreLoading,
    weatherLoading,
    coreError,
    weatherError,
    setCoreLoading,
    setWeatherLoading,
    setCoreError,
    setWeatherError,
  };
}
