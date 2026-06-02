import type { City, MapPoint, Poi, PoiCategory, RouteMode, RouteResult } from "../src/types";
import { DEFAULT_CITY_ADCODE, DEFAULT_CITY_ID, DEFAULT_CITY_NAME, DEFAULT_CITY_OFFICIAL_NAME } from "./config/city";

export type MapProviderMeta = {
  provider: string;
  coordinateSystem: "GCJ-02";
  fallback: boolean;
  failureReason?: string;
};

export type PoiSearchInput = {
  keyword?: string;
  cityId?: string;
  category?: PoiCategory | "全部";
  tags?: string[];
  lng?: number;
  lat?: number;
  limit?: number;
  radius?: number;
};

export type NearbyPoi = Poi & { distanceMeters?: number };

export type PoiSearchResult = MapProviderMeta & {
  items: NearbyPoi[];
};

export type RouteRequest = {
  origin?: MapPoint;
  destination?: MapPoint;
  waypoints?: MapPoint[];
  mode?: RouteMode;
  preferences?: string[];
  cityId?: string;
};

export type GeocodeResult = MapProviderMeta & {
  point?: MapPoint;
  formattedAddress?: string;
  adcode?: string;
  city?: string;
};

export type ReverseGeocodeResult = MapProviderMeta & {
  address?: string;
  adcode?: string;
  poi?: NearbyPoi;
  distanceMeters?: number;
};

export type WeatherResult = MapProviderMeta & {
  city?: string;
  adcode?: string;
  live?: {
    weather?: string;
    temperature?: string;
    windDirection?: string;
    windPower?: string;
    humidity?: string;
    reportTime?: string;
  };
  summary?: string;
};

export type MapProvider = {
  searchPois(input: PoiSearchInput): Promise<PoiSearchResult>;
  route(input: RouteRequest): Promise<RouteResult>;
  geocode(input: { keyword: string; cityId?: string }): Promise<GeocodeResult>;
  reverseGeocode(input: { lng: number; lat: number; cityId?: string }): Promise<ReverseGeocodeResult>;
  weather(input: { cityId?: string; adcode?: string }): Promise<WeatherResult>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type MapProviderConfig = {
  provider?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  typecode?: string;
  address?: string | unknown[];
  location?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  adcode?: string;
  distance?: string | number;
  biz_ext?: {
    rating?: string;
  };
};

type AmapResponse = {
  status?: string | number;
  infocode?: string | number;
  info?: string;
  errdetail?: string;
  pois?: AmapPoi[];
  geocodes?: Array<{
    formatted_address?: string;
    location?: string;
    adcode?: string;
    city?: string;
  }>;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      adcode?: string;
    };
    pois?: AmapPoi[];
  };
  lives?: Array<{
    city?: string;
    adcode?: string;
    weather?: string;
    temperature?: string;
    winddirection?: string;
    windpower?: string;
    humidity?: string;
    reporttime?: string;
  }>;
  route?: {
    paths?: AmapRoutePath[];
    transits?: AmapRoutePath[];
  };
  data?: {
    paths?: AmapRoutePath[];
  };
};

type AmapRoutePath = {
  distance?: string | number;
  duration?: string | number;
  cost?: {
    duration?: string | number;
  };
  steps?: Array<{ polyline?: string; tmcs?: Array<{ polyline?: string }> }>;
  segments?: Array<{
    walking?: { steps?: Array<{ polyline?: string }> };
    bus?: { buslines?: Array<{ polyline?: string }> };
  }>;
};

const AMAP_BASE_URL = "https://restapi.amap.com";
const DEFAULT_TIMEOUT_MS = 3500;

export function createMapProvider(data: { pois: Poi[]; cities: City[] }, config: MapProviderConfig = {}): MapProvider {
  const provider = normalizeProvider(config.provider ?? process.env.MAP_PROVIDER ?? "fallback");
  const apiKey = config.apiKey ?? process.env.MAP_API_KEY ?? "";
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = config.fetchImpl ?? fetch;

  async function searchPois(input: PoiSearchInput): Promise<PoiSearchResult> {
    const normalized = normalizeSearchInput(input);
    if (!canUseAmap(provider, apiKey)) {
      return localPoiSearch(normalized, fallbackReason(provider, apiKey));
    }

    try {
      const city = resolveCity(data.cities, normalized.cityId);
      const params: Record<string, string | number | undefined> = {
        keywords: normalized.keyword,
        city: city.adcode,
        citylimit: "true",
        offset: normalized.limit,
        page: 1,
        extensions: "base"
      };

      const response = Number.isFinite(normalized.lng) && Number.isFinite(normalized.lat)
        ? await amapGet("/v3/place/around", {
          ...params,
          location: `${normalized.lng},${normalized.lat}`,
          radius: normalized.radius ?? 3000
        })
        : await amapGet("/v3/place/text", params);
      const items = (response.pois ?? [])
        .map((poi) => mapAmapPoi(poi, normalized.cityId ?? city.id))
        .filter((poi): poi is NearbyPoi => Boolean(poi))
        .slice(0, normalized.limit);
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: false,
        items
      };
    } catch (error) {
      return localPoiSearch(normalized, parseFailureReason(error));
    }
  }

  async function route(input: RouteRequest): Promise<RouteResult> {
    const normalized = normalizeRouteInput(input, data.pois);
    if (!canUseAmap(provider, apiKey)) {
      return localRoute(normalized, fallbackReason(provider, apiKey));
    }

    try {
      const mode = normalized.mode ?? "walking";
      const endpoint = routeEndpoint(mode);
      const city = resolveCity(data.cities, normalized.cityId);
      const params: Record<string, string | number | undefined> = {
        origin: pointToAmap(normalized.origin),
        destination: pointToAmap(normalized.destination),
        show_fields: "cost,polyline",
        strategy: mode === "driving" ? 32 : undefined
      };
      if (normalized.waypoints?.length && mode === "driving") {
        params.waypoints = normalized.waypoints.map(pointToAmap).join(";");
      }
      if (mode === "transit") {
        params.city1 = city.adcode;
        params.city2 = city.adcode;
      }
      const response = await amapGet(endpoint, params);
      const path = firstRoutePath(response);
      if (!path) throw new Error("AMap route response has no path.");
      const distanceMeters = toNumber(path.distance) ?? 0;
      const durationSeconds = toNumber(path.duration) ?? toNumber(path.cost?.duration) ?? 0;
      const parsedPoints = parseRoutePoints(path);
      const points = parsedPoints.length > 0
        ? parsedPoints
        : [normalized.origin, ...(normalized.waypoints ?? []), normalized.destination];
      return {
        provider,
        coordinateSystem: "GCJ-02",
        mode,
        distanceMeters: Math.round(distanceMeters),
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        points,
        waypointNames: [normalized.origin, ...(normalized.waypoints ?? []), normalized.destination]
          .map((point, index) => point.name ?? `途经点 ${index + 1}`),
        preferences: normalized.preferences ?? ["少排队"],
        fallback: false
      };
    } catch (error) {
      return localRoute(normalized, parseFailureReason(error));
    }
  }

  async function geocode(input: { keyword: string; cityId?: string }): Promise<GeocodeResult> {
    const keyword = input.keyword.trim();
    if (!canUseAmap(provider, apiKey)) {
      return localGeocode(keyword, input.cityId, fallbackReason(provider, apiKey));
    }

    try {
      const city = resolveCity(data.cities, input.cityId);
      const response = await amapGet("/v3/geocode/geo", {
        address: keyword,
        city: city.adcode
      });
      const geocodeResult = response.geocodes?.[0];
      const point = parseLocation(geocodeResult?.location);
      if (!point) throw new Error("AMap geocode response has no valid location.");
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: false,
        point,
        formattedAddress: geocodeResult?.formatted_address,
        adcode: geocodeResult?.adcode,
        city: geocodeResult?.city
      };
    } catch (error) {
      return localGeocode(keyword, input.cityId, parseFailureReason(error));
    }
  }

  async function reverseGeocode(input: { lng: number; lat: number; cityId?: string }): Promise<ReverseGeocodeResult> {
    if (!canUseAmap(provider, apiKey)) {
      return localReverseGeocode(input.lng, input.lat, fallbackReason(provider, apiKey));
    }

    try {
      const response = await amapGet("/v3/geocode/regeo", {
        location: `${input.lng},${input.lat}`,
        extensions: "base",
        radius: 1000
      });
      const regeo = response.regeocode;
      const firstPoi = regeo?.pois?.[0];
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: false,
        address: regeo?.formatted_address,
        adcode: regeo?.addressComponent?.adcode,
        poi: firstPoi ? mapAmapPoi(firstPoi, input.cityId ?? DEFAULT_CITY_ID) : undefined,
        distanceMeters: firstPoi ? Math.round(toNumber(firstPoi.distance) ?? 0) : undefined
      };
    } catch (error) {
      return localReverseGeocode(input.lng, input.lat, parseFailureReason(error));
    }
  }

  async function weather(input: { cityId?: string; adcode?: string }): Promise<WeatherResult> {
    const city = input.adcode
      ? data.cities.find((item) => item.adcode === input.adcode) ?? resolveCity(data.cities, input.cityId)
      : resolveCity(data.cities, input.cityId);
    if (!canUseAmap(provider, apiKey)) {
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: true,
        city: city.name,
        adcode: city.adcode,
        failureReason: fallbackReason(provider, apiKey)
      };
    }

    try {
      const response = await amapGet("/v3/weather/weatherInfo", {
        city: input.adcode ?? city.adcode,
        extensions: "base"
      });
      const live = response.lives?.[0];
      if (!live) throw new Error("AMap weather response has no live weather.");
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: false,
        city: live.city ?? city.name,
        adcode: live.adcode ?? city.adcode,
        live: {
          weather: live.weather,
          temperature: live.temperature,
          windDirection: live.winddirection,
          windPower: live.windpower,
          humidity: live.humidity,
          reportTime: live.reporttime
        },
        summary: `${live.city ?? city.name} ${live.weather ?? "天气"} ${live.temperature ?? "--"}℃，${live.reporttime ?? "官方接口"}发布`
      };
    } catch (error) {
      return {
        provider,
        coordinateSystem: "GCJ-02",
        fallback: true,
        city: city.name,
        adcode: city.adcode,
        failureReason: parseFailureReason(error)
      };
    }
  }

  async function amapGet(path: string, params: Record<string, string | number | undefined>): Promise<AmapResponse> {
    const url = new URL(path, AMAP_BASE_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("output", "JSON");
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error(`AMap HTTP ${response.status}`);
      const payload = await response.json() as AmapResponse;
      assertAmapSuccess(payload);
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { searchPois, route, geocode, reverseGeocode, weather };

  function localPoiSearch(input: Required<Pick<PoiSearchInput, "limit">> & PoiSearchInput, failureReason: string): PoiSearchResult {
    const keyword = input.keyword ? normalize(input.keyword) : "";
    const tags = input.tags?.map(normalize) ?? [];
    const cityId = input.cityId ?? DEFAULT_CITY_ID;
    const candidates = data.pois
      .filter((poi) => {
        const text = normalize([poi.name, poi.address, poi.category, poi.description, ...poi.tags].filter(Boolean).join(" "));
        return (!keyword || text.includes(keyword))
          && (!cityId || poi.cityId === cityId)
          && (!input.category || input.category === "全部" || poi.category === input.category)
          && (tags.length === 0 || tags.some((tag) => text.includes(tag)));
      });
    const items = Number.isFinite(input.lng) && Number.isFinite(input.lat)
      ? candidates
        .map((poi) => ({ ...poi, distanceMeters: Math.round(distanceMeters({ lng: input.lng!, lat: input.lat! }, poi)) }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
      : candidates.slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return {
      provider,
      coordinateSystem: "GCJ-02",
      fallback: true,
      failureReason,
      items: items.slice(0, input.limit)
    };
  }

  function localRoute(input: Required<Pick<RouteRequest, "origin" | "destination" | "mode">> & RouteRequest, failureReason: string): RouteResult {
    const points = [input.origin, ...(input.waypoints ?? []), input.destination];
    const distance = points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index], point), 0);
    const speedMetersPerMinute = input.mode === "driving" ? 420 : input.mode === "transit" ? 320 : input.mode === "bicycling" ? 180 : 75;
    return {
      provider,
      coordinateSystem: "GCJ-02",
      mode: input.mode,
      distanceMeters: Math.round(distance * 1.18),
      durationMinutes: Math.max(1, Math.round((distance * 1.18) / speedMetersPerMinute)),
      points,
      waypointNames: points.map((point, index) => point.name ?? `途经点 ${index + 1}`),
      preferences: input.preferences ?? ["少排队"],
      fallback: true,
      failureReason
    };
  }

  function localGeocode(keyword: string, cityId = DEFAULT_CITY_ID, failureReason: string): GeocodeResult {
    const clean = normalize(keyword);
    const poi = data.pois.find((item) => item.cityId === cityId && normalize([item.name, item.address, item.category].filter(Boolean).join(" ")).includes(clean));
    return {
      provider,
      coordinateSystem: "GCJ-02",
      fallback: true,
      point: poi ? pointFromPoi(poi) : undefined,
      formattedAddress: poi?.address,
      adcode: poi?.source?.amapAdcode,
      city: resolveCity(data.cities, cityId).name,
      failureReason: poi ? failureReason : `${failureReason}; no local POI matched geocode keyword.`
    };
  }

  function localReverseGeocode(lng: number, lat: number, failureReason: string): ReverseGeocodeResult {
    const nearest = data.pois
      .map((poi) => ({ poi, distanceMeters: distanceMeters({ lng, lat }, poi) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    return {
      provider,
      coordinateSystem: "GCJ-02",
      fallback: true,
      address: nearest?.poi.address,
      poi: nearest ? { ...nearest.poi, distanceMeters: Math.round(nearest.distanceMeters) } : undefined,
      distanceMeters: nearest ? Math.round(nearest.distanceMeters) : undefined,
      failureReason
    };
  }
}

function assertAmapSuccess(payload: AmapResponse) {
  if (payload.status !== undefined && String(payload.status) !== "1") {
    throw new Error(formatAmapError(payload));
  }
  if (payload.infocode !== undefined && String(payload.infocode) !== "10000") {
    throw new Error(formatAmapError(payload));
  }
}

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase() || "fallback";
}

function canUseAmap(provider: string, apiKey: string) {
  return provider === "amap" && apiKey.trim().length > 0;
}

function fallbackReason(provider: string, apiKey: string) {
  if (provider !== "amap") return `MAP_PROVIDER=${provider}; returned deterministic fallback.`;
  if (!apiKey.trim()) return "MAP_API_KEY is not configured; returned deterministic fallback.";
  return "AMap provider is unavailable; returned deterministic fallback.";
}

function parseFailureReason(error: unknown) {
  if (error instanceof Error) return `${error.message}; returned deterministic fallback.`;
  return "Unknown map provider failure; returned deterministic fallback.";
}

function formatAmapError(payload: AmapResponse) {
  return `AMap error status=${payload.status ?? "unknown"} infocode=${payload.infocode ?? "unknown"} info=${payload.info ?? payload.errdetail ?? "unknown"}`;
}

function normalizeSearchInput(input: PoiSearchInput): Required<Pick<PoiSearchInput, "limit">> & PoiSearchInput {
  return {
    ...input,
    keyword: input.keyword?.trim(),
    limit: Math.min(Math.max(input.limit ?? 10, 1), 30)
  };
}

function normalizeRouteInput(input: RouteRequest, pois: Poi[]): Required<Pick<RouteRequest, "origin" | "destination" | "mode">> & RouteRequest {
  const basePois = pois.filter((poi) => poi.cityId === (input.cityId ?? DEFAULT_CITY_ID) && poi.category === "景点").slice(0, 5);
  const origin = input.origin ?? pointFromPoi(basePois[0]);
  const destination = input.destination ?? pointFromPoi(basePois[3] ?? basePois[0]);
  return {
    ...input,
    origin,
    destination,
    mode: input.mode ?? "walking"
  };
}

function routeEndpoint(mode: RouteMode) {
  if (mode === "driving") return "/v5/direction/driving";
  if (mode === "transit") return "/v5/direction/transit/integrated";
  if (mode === "bicycling") return "/v5/direction/bicycling";
  return "/v5/direction/walking";
}

function resolveCity(cities: City[], cityId = DEFAULT_CITY_ID) {
  return cities.find((city) => city.id === cityId || city.adcode === cityId || city.name === cityId || city.officialName === cityId)
    ?? cities.find((city) => city.id === DEFAULT_CITY_ID)
    ?? cities[0]
    ?? { id: DEFAULT_CITY_ID, name: DEFAULT_CITY_NAME, officialName: DEFAULT_CITY_OFFICIAL_NAME, pinyin: DEFAULT_CITY_ID, adcode: DEFAULT_CITY_ADCODE, level: "city" };
}

function mapAmapPoi(poi: AmapPoi, cityId: string): NearbyPoi | undefined {
  const point = parseLocation(poi.location);
  if (!point || !poi.name) return undefined;
  const typeText = poi.type ?? "";
  const category = mapPoiCategory(typeText);
  const tags = [poi.type, poi.pname, poi.cityname, poi.adname].filter((tag): tag is string => Boolean(tag));
  const address = Array.isArray(poi.address) ? poi.address.join("") : poi.address;
  return {
    id: `amap:${poi.id ?? `${poi.name}-${poi.location}`}`,
    name: poi.name,
    cityId,
    category,
    tags,
    lng: point.lng,
    lat: point.lat,
    coordinateSystem: "GCJ-02",
    address: typeof address === "string" && address ? address : undefined,
    rating: toNumber(poi.biz_ext?.rating),
    source: {
      provider: "amap",
      endpoint: "web-service",
      amapId: poi.id,
      amapType: poi.typecode,
      amapAdcode: poi.adcode,
      collectedAt: new Date().toISOString()
    },
    distanceMeters: poi.distance !== undefined ? Math.round(toNumber(poi.distance) ?? 0) : undefined
  };
}

function mapPoiCategory(typeText: string): PoiCategory {
  if (/餐饮|美食|小吃|咖啡|茶/.test(typeText)) return "美食";
  if (/购物|商场|超市/.test(typeText)) return "购物";
  if (/博物馆|展览|文化|艺术|剧场|影院/.test(typeText)) return "文化艺术";
  if (/公园|风景|自然|山|湖|湿地/.test(typeText)) return "公园自然";
  if (/历史|遗址|寺|塔|古迹/.test(typeText)) return "历史遗迹";
  if (/儿童|亲子|游乐/.test(typeText)) return "亲子游";
  if (/酒吧|夜|娱乐/.test(typeText)) return "夜生活";
  return "景点";
}

function firstRoutePath(response: AmapResponse) {
  return response.route?.paths?.[0]
    ?? response.route?.transits?.[0]
    ?? response.data?.paths?.[0];
}

function parseRoutePoints(path: AmapRoutePath): MapPoint[] {
  const polylines: string[] = [];
  path.steps?.forEach((step) => {
    if (step.polyline) polylines.push(step.polyline);
    step.tmcs?.forEach((tmc) => {
      if (tmc.polyline) polylines.push(tmc.polyline);
    });
  });
  path.segments?.forEach((segment) => {
    segment.walking?.steps?.forEach((step) => {
      if (step.polyline) polylines.push(step.polyline);
    });
    segment.bus?.buslines?.forEach((line) => {
      if (line.polyline) polylines.push(line.polyline);
    });
  });
  return polylines.flatMap(parsePolyline);
}

function parsePolyline(polyline: string): MapPoint[] {
  return polyline.split(";")
    .map(parseLocation)
    .filter((point): point is MapPoint => Boolean(point));
}

function parseLocation(location?: string): MapPoint | undefined {
  if (!location) return undefined;
  const [lngText, latText] = location.split(",");
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  return { lng, lat };
}

function pointToAmap(point: MapPoint) {
  return `${point.lng},${point.lat}`;
}

function pointFromPoi(poi: Poi): MapPoint {
  return { name: poi.name, lng: poi.lng, lat: poi.lat };
}

function distanceMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const radius = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
