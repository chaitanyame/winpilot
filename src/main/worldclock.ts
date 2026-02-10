// World Clock Implementation

export interface WorldClockCity {
  name: string;
  timezone: string; // IANA timezone name (e.g., "America/New_York")
  country?: string;
  flag?: string;
}

export interface WorldClockTime {
  city: WorldClockCity;
  time: string;
  date: string;
  isDaylightSavings: boolean;
  utcOffset: string;
}

// Default cities for world clock
export const DEFAULT_CITIES: WorldClockCity[] = [
  { name: 'New York', timezone: 'America/New_York', country: 'USA', flag: '🇺🇸' },
  { name: 'London', timezone: 'Europe/London', country: 'UK', flag: '🇬🇧' },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', country: 'Japan', flag: '🇯🇵' },
  { name: 'Sydney', timezone: 'Australia/Sydney', country: 'Australia', flag: '🇦🇺' },
  { name: 'Paris', timezone: 'Europe/Paris', country: 'France', flag: '🇫🇷' },
  { name: 'Dubai', timezone: 'Asia/Dubai', country: 'UAE', flag: '🇦🇪' },
  { name: 'Singapore', timezone: 'Asia/Singapore', country: 'Singapore', flag: '🇸🇬' },
  { name: 'Los Angeles', timezone: 'America/Los_Angeles', country: 'USA', flag: '🇺🇸' },
];

/**
 * Get current time for a specific timezone
 */
export function getTimeForTimezone(timezone: string): WorldClockTime {
  const now = new Date();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    const time = `${getPart('hour')}:${getPart('minute')}:${getPart('second')} ${getPart('dayPeriod')}`;
    const date = `${getPart('weekday')}, ${getPart('month')} ${getPart('day')}, ${getPart('year')}`;

    // Get UTC offset
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));
    const utcOffset = offsetHours >= 0
      ? `UTC+${offsetHours}`
      : `UTC${offsetHours}`;

    // Check if DST is in effect (basic check)
    const stdFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'long'
    });
    const dstPart = stdFormatter.formatToParts(now).find(p => p.type === 'timeZoneName');
    const isDaylightSavings = dstPart?.value?.toLowerCase().includes('daylight') || false;

    return {
      city: { name: '', timezone }, // Placeholder, will be filled by caller
      time,
      date,
      isDaylightSavings,
      utcOffset
    };
  } catch (error) {
    // Invalid timezone
    return {
      city: { name: '', timezone },
      time: '--:--:-- --',
      date: 'Invalid timezone',
      isDaylightSavings: false,
      utcOffset: 'UTC'
    };
  }
}

/**
 * Get times for multiple cities
 */
export function getWorldClockTimes(cities: WorldClockCity[]): WorldClockTime[] {
  return cities.map(city => ({
    ...getTimeForTimezone(city.timezone),
    city
  }));
}

/**
 * Get a formatted world clock display
 */
export function formatWorldClock(cities: WorldClockCity[]): string {
  const times = getWorldClockTimes(cities);

  let output = '🌍 World Clock\n\n';

  for (const time of times) {
    output += `${time.city.flag || ''} ${time.city.name}, ${time.city.country || ''}\n`;
    output += `  ${time.time} (${time.utcOffset})\n`;
    output += `  ${time.date}\n\n`;
  }

  return output;
}

/**
 * Search for cities by name or timezone
 */
export function searchCities(query: string): WorldClockCity[] {
  const lowerQuery = query.toLowerCase();

  return DEFAULT_CITIES.filter(city =>
    city.name.toLowerCase().includes(lowerQuery) ||
    city.timezone.toLowerCase().includes(lowerQuery) ||
    city.country?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all available cities
 */
export function getAllCities(): WorldClockCity[] {
  return [...DEFAULT_CITIES];
}
