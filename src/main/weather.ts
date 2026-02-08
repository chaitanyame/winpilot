// Weather lookup using wttr.in API (free, no API key)

import * as https from 'https';

export async function fetchWeather(location: string, detailed: boolean): Promise<string> {
  const encodedLocation = encodeURIComponent(location);
  const format = detailed ? 'j1' : '3';
  const url = `https://wttr.in/${encodedLocation}?format=${format}`;

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Desktop-Commander/0.1.0' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(`Weather unavailable for "${location}" (HTTP ${res.statusCode})`);
          return;
        }

        if (!detailed) {
          resolve(data.trim());
          return;
        }

        try {
          const json = JSON.parse(data);
          resolve(formatDetailedWeather(json, location));
        } catch {
          resolve(data.trim());
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(`Weather request timed out for "${location}".`);
    });

    req.on('error', () => {
      resolve(`Failed to fetch weather for "${location}".`);
    });
  });
}

function formatDetailedWeather(data: Record<string, unknown>, location: string): string {
  const current = (data.current_condition as Array<Record<string, unknown>>)?.[0];
  const forecast = data.weather as Array<Record<string, unknown>>;

  if (!current) return `No weather data for "${location}".`;

  const lines = [];
  lines.push(`**Weather for ${location}**`);
  lines.push('');

  const desc = (current.weatherDesc as Array<{ value: string }>)?.[0]?.value || 'Unknown';
  lines.push(`**Now**: ${desc}`);
  lines.push(`  Temp: ${current.temp_C}°C (${current.temp_F}°F)`);
  lines.push(`  Feels like: ${current.FeelsLikeC}°C`);
  lines.push(`  Humidity: ${current.humidity}%`);
  lines.push(`  Wind: ${current.windspeedKmph} km/h ${current.winddir16Point}`);

  if (forecast && forecast.length > 0) {
    lines.push('');
    lines.push('**Forecast:**');
    for (const day of forecast.slice(0, 3)) {
      const date = day.date as string;
      const maxTemp = day.maxtempC;
      const minTemp = day.mintempC;
      const hourly = day.hourly as Array<Record<string, unknown>>;
      const noonDesc = (hourly?.[4]?.weatherDesc as Array<{ value: string }>)?.[0]?.value || '';
      lines.push(`  ${date}: ${minTemp}°C - ${maxTemp}°C, ${noonDesc}`);
    }
  }

  return lines.join('\n');
}
