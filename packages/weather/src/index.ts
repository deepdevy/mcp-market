#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-weather",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface GeoResult {
  results?: Array<{
    name: string;
    country: string;
    country_code: string;
    latitude: number;
    longitude: number;
    timezone: string;
    admin1?: string;
  }>;
}

interface CurrentWeather {
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    is_day: number;
    time: string;
  };
}

interface ForecastResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    weathercode: number[];
  };
}

interface AirQualityResponse {
  current: {
    pm2_5: number;
    pm10: number;
    uv_index: number;
    us_aqi: number;
  };
}

// ── Helpers ────────────────────────────────────────────────

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeather(code: number): string {
  return WMO_CODES[code] ?? `Unknown (code ${code})`;
}

async function geocode(city: string) {
  const data = await fetchJSON<GeoResult>(
    buildURL("https://geocoding-api.open-meteo.com/v1/search", {
      name: city,
      count: 1,
      language: "en",
      format: "json",
    })
  );

  if (!data.results?.length) {
    return null;
  }
  return data.results[0];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_current_weather",
  "Get current weather conditions for any city worldwide",
  {
    city: z.string().describe("City name (e.g. Seoul, Tokyo, New York, London)"),
  },
  async ({ city }) => {
    const geo = await geocode(city);
    if (!geo) return error(`City "${city}" not found`);

    const data = await fetchJSON<CurrentWeather>(
      buildURL("https://api.open-meteo.com/v1/forecast", {
        latitude: geo.latitude,
        longitude: geo.longitude,
        current_weather: true,
      })
    );

    const w = data.current_weather;
    const location = geo.admin1 ? `${geo.name}, ${geo.admin1}, ${geo.country}` : `${geo.name}, ${geo.country}`;

    return text(
      keyValue({
        "📍 Location": location,
        "🌡️ Temperature": `${w.temperature}°C`,
        "🌤️ Condition": describeWeather(w.weathercode),
        "💨 Wind": `${w.windspeed} km/h (${w.winddirection}°)`,
        "🕐 Local time": w.time,
        "☀️ Daytime": w.is_day ? "Yes" : "No",
      })
    );
  }
);

server.tool(
  "get_forecast",
  "Get weather forecast for up to 7 days for any city",
  {
    city: z.string().describe("City name"),
    days: z
      .number()
      .min(1)
      .max(7)
      .default(3)
      .describe("Number of forecast days (1-7, default 3)"),
  },
  async ({ city, days }) => {
    const geo = await geocode(city);
    if (!geo) return error(`City "${city}" not found`);

    const data = await fetchJSON<ForecastResponse>(
      buildURL("https://api.open-meteo.com/v1/forecast", {
        latitude: geo.latitude,
        longitude: geo.longitude,
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode",
        forecast_days: days,
        timezone: geo.timezone,
      })
    );

    const d = data.daily;
    const lines = d.time.map(
      (date, i) =>
        `${date}: ${describeWeather(d.weathercode[i])}, ` +
        `${d.temperature_2m_min[i]}°C ~ ${d.temperature_2m_max[i]}°C, ` +
        `precipitation ${d.precipitation_sum[i]}mm (${d.precipitation_probability_max[i]}%)`
    );

    const location = geo.admin1 ? `${geo.name}, ${geo.admin1}, ${geo.country}` : `${geo.name}, ${geo.country}`;

    return text(`📍 ${location} — ${days}-day forecast\n\n${lines.join("\n")}`);
  }
);

server.tool(
  "get_historical_weather",
  "Get weather data for a specific past date at any city",
  {
    city: z.string().describe("City name"),
    date: z.string().describe("Date in YYYY-MM-DD format (e.g. 2024-01-15)"),
  },
  async ({ city, date }) => {
    const geo = await geocode(city);
    if (!geo) return error(`City "${city}" not found`);

    const data = await fetchJSON<ForecastResponse>(
      buildURL("https://archive-api.open-meteo.com/v1/archive", {
        latitude: geo.latitude,
        longitude: geo.longitude,
        start_date: date,
        end_date: date,
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
        timezone: geo.timezone,
      })
    );

    const d = data.daily;
    if (!d.time?.length) return error(`No historical data for ${date}`);

    const location = geo.admin1 ? `${geo.name}, ${geo.admin1}, ${geo.country}` : `${geo.name}, ${geo.country}`;

    return text(
      keyValue({
        "📍 Location": location,
        "📅 Date": d.time[0],
        "🌤️ Condition": describeWeather(d.weathercode[0]),
        "🌡️ Max temp": `${d.temperature_2m_max[0]}°C`,
        "🌡️ Min temp": `${d.temperature_2m_min[0]}°C`,
        "🌧️ Precipitation": `${d.precipitation_sum[0]}mm`,
      })
    );
  }
);

server.tool(
  "get_air_quality",
  "Get current air quality index (PM2.5, PM10, UV) for any city",
  {
    city: z.string().describe("City name"),
  },
  async ({ city }) => {
    const geo = await geocode(city);
    if (!geo) return error(`City "${city}" not found`);

    const data = await fetchJSON<AirQualityResponse>(
      buildURL("https://air-quality-api.open-meteo.com/v1/air-quality", {
        latitude: geo.latitude,
        longitude: geo.longitude,
        current: "pm2_5,pm10,uv_index,us_aqi",
      })
    );

    const c = data.current;
    const aqiLabel =
      c.us_aqi <= 50
        ? "Good 🟢"
        : c.us_aqi <= 100
          ? "Moderate 🟡"
          : c.us_aqi <= 150
            ? "Unhealthy for sensitive groups 🟠"
            : c.us_aqi <= 200
              ? "Unhealthy 🔴"
              : "Very unhealthy 🟣";

    return text(
      keyValue({
        "📍 Location": `${geo.name}, ${geo.country}`,
        "🏭 US AQI": `${c.us_aqi} — ${aqiLabel}`,
        "💨 PM2.5": `${c.pm2_5} μg/m³`,
        "💨 PM10": `${c.pm10} μg/m³`,
        "☀️ UV Index": c.uv_index,
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
