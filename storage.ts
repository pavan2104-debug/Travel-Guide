import { cities, weatherData, cityInfo, smsRequests, type City, type InsertCity, type WeatherData, type InsertWeatherData, type CityInfo, type InsertCityInfo, type SmsRequest, type InsertSmsRequest } from "@shared/schema";

export interface IStorage {
  // Cities
  getCity(id: number): Promise<City | undefined>;
  getCityByName(name: string): Promise<City | undefined>;
  createCity(city: InsertCity): Promise<City>;
  
  // Weather Data
  getWeatherByCity(cityId: number): Promise<WeatherData | undefined>;
  createOrUpdateWeather(weather: InsertWeatherData): Promise<WeatherData>;
  
  // City Information
  getCityInfo(cityId: number): Promise<CityInfo | undefined>;
  createOrUpdateCityInfo(info: InsertCityInfo): Promise<CityInfo>;
  
  // SMS Requests
  createSmsRequest(request: InsertSmsRequest): Promise<SmsRequest>;
  updateSmsRequestStatus(id: number, status: string, sentAt?: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private cities: Map<number, City>;
  private weatherData: Map<number, WeatherData>;
  private cityInfo: Map<number, CityInfo>;
  private smsRequests: Map<number, SmsRequest>;
  private currentCityId: number;
  private currentWeatherId: number;
  private currentInfoId: number;
  private currentSmsId: number;

  constructor() {
    this.cities = new Map();
    this.weatherData = new Map();
    this.cityInfo = new Map();
    this.smsRequests = new Map();
    this.currentCityId = 1;
    this.currentWeatherId = 1;
    this.currentInfoId = 1;
    this.currentSmsId = 1;

    // Pre-populate with major Indian cities
    this.seedCities();
  }

  private async seedCities() {
    const majorCities = [
      { name: "Mumbai", state: "Maharashtra", country: "India", latitude: 19.0760, longitude: 72.8777 },
      { name: "Delhi", state: "Delhi", country: "India", latitude: 28.7041, longitude: 77.1025 },
      { name: "Bangalore", state: "Karnataka", country: "India", latitude: 12.9716, longitude: 77.5946 },
      { name: "Chennai", state: "Tamil Nadu", country: "India", latitude: 13.0827, longitude: 80.2707 },
      { name: "Kolkata", state: "West Bengal", country: "India", latitude: 22.5726, longitude: 88.3639 },
      { name: "Hyderabad", state: "Telangana", country: "India", latitude: 17.3850, longitude: 78.4867 },
      { name: "Pune", state: "Maharashtra", country: "India", latitude: 18.5204, longitude: 73.8567 },
      { name: "Ahmedabad", state: "Gujarat", country: "India", latitude: 23.0225, longitude: 72.5714 },
    ];

    for (const cityData of majorCities) {
      await this.createCity(cityData);
    }
  }

  async getCity(id: number): Promise<City | undefined> {
    return this.cities.get(id);
  }

  async getCityByName(name: string): Promise<City | undefined> {
    return Array.from(this.cities.values()).find(
      (city) => city.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createCity(insertCity: InsertCity): Promise<City> {
    const id = this.currentCityId++;
    const city: City = { ...insertCity, id };
    this.cities.set(id, city);
    return city;
  }

  async getWeatherByCity(cityId: number): Promise<WeatherData | undefined> {
    return Array.from(this.weatherData.values()).find(
      (weather) => weather.cityId === cityId
    );
  }

  async createOrUpdateWeather(weather: InsertWeatherData): Promise<WeatherData> {
    const existing = Array.from(this.weatherData.values()).find(
      (w) => w.cityId === weather.cityId
    );

    if (existing) {
      const updated = { ...existing, ...weather };
      this.weatherData.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentWeatherId++;
      const newWeather: WeatherData = { ...weather, id };
      this.weatherData.set(id, newWeather);
      return newWeather;
    }
  }

  async getCityInfo(cityId: number): Promise<CityInfo | undefined> {
    return Array.from(this.cityInfo.values()).find(
      (info) => info.cityId === cityId
    );
  }

  async createOrUpdateCityInfo(info: InsertCityInfo): Promise<CityInfo> {
    const existing = Array.from(this.cityInfo.values()).find(
      (i) => i.cityId === info.cityId
    );

    if (existing) {
      const updated = { ...existing, ...info };
      this.cityInfo.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentInfoId++;
      const newInfo: CityInfo = { ...info, id };
      this.cityInfo.set(id, newInfo);
      return newInfo;
    }
  }

  async createSmsRequest(request: InsertSmsRequest): Promise<SmsRequest> {
    const id = this.currentSmsId++;
    const smsRequest: SmsRequest = { 
      ...request, 
      id,
      status: "pending",
      sentAt: null
    };
    this.smsRequests.set(id, smsRequest);
    return smsRequest;
  }

  async updateSmsRequestStatus(id: number, status: string, sentAt?: string): Promise<void> {
    const request = this.smsRequests.get(id);
    if (request) {
      this.smsRequests.set(id, { ...request, status, sentAt: sentAt || null });
    }
  }
}

export const storage = new MemStorage();
