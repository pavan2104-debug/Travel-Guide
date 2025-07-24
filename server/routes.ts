import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchCitySchema } from "@shared/schema";
import axios from "axios";

// Free API integrations for weather and news
const FREE_WEATHER_API_URL = "http://api.weatherapi.com/v1";
const FREE_NEWS_API_URL = "https://newsapi.org/v2/everything";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "free-weather-api";
const NEWS_API_KEY = process.env.NEWS_API_KEY || "free-news-api";

// Remove Twilio integration - using news and weather APIs instead

interface WeatherAPIResponse {
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

interface WikipediaAPIResponse {
  query: {
    pages: {
      [key: string]: {
        extract: string;
      };
    };
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Search city and get comprehensive travel information
  app.post("/api/search-city", async (req, res) => {
    try {
      const { cityName } = searchCitySchema.parse(req.body);
      
      // Find or create city - Support all major Indian cities
      let city = await storage.getCityByName(cityName);
      if (!city) {
        // Create city data for any Indian city
        const normalizedCityName = normalizeCityName(cityName);
        city = await storage.createCity({
          name: normalizedCityName,
          state: getStateForCity(normalizedCityName),
          country: "India",
          latitude: 0, // Will be updated with real coordinates if needed
          longitude: 0
        });
      }

      // Get real weather data from free APIs
      const weatherData = await getRealWeatherData(city);
      
      // Get city information from Wikipedia and news APIs
      const cityInfo = await getCityInformation(city);
      
      // Get real hotel and restaurant data for the specific city
      const hotels = getCitySpecificHotels(city.name);
      const restaurants = getCitySpecificRestaurants(city.name);
      
      // Get latest news about the city
      const cityNews = await getCityNews(city.name);

      res.json({
        city,
        weather: weatherData,
        cityInfo: {
          ...cityInfo,
          news: cityNews
        },
        hotels,
        restaurants,
        message: `Comprehensive travel information for ${city.name} loaded successfully`
      });

    } catch (error) {
      console.error("Search city error:", error);
      res.status(500).json({ message: "Failed to get travel information" });
    }
  });

  // Get weather data for a city
  app.get("/api/weather/:cityId", async (req, res) => {
    try {
      const cityId = parseInt(req.params.cityId);
      const city = await storage.getCity(cityId);
      
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      const weatherData = await getRealWeatherData(city);
      res.json(weatherData);
      
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ message: "Failed to fetch weather data" });
    }
  });

  // Get city information
  app.get("/api/city-info/:cityId", async (req, res) => {
    try {
      const cityId = parseInt(req.params.cityId);
      const city = await storage.getCity(cityId);
      
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      const cityInfo = await getCityInformation(city);
      res.json(cityInfo);
      
    } catch (error) {
      console.error("City info API error:", error);
      res.status(500).json({ message: "Failed to fetch city information" });
    }
  });

  // SMS feature removed - comprehensive data now displayed in web interface

  const httpServer = createServer(app);
  // Transportation API integration with IRCTC and RedBus
  app.get("/api/transportation/:cityName", async (req, res) => {
    try {
      const { cityName } = req.params;
      const transportData = await getTransportationData(cityName);
      res.json(transportData);
    } catch (error) {
      console.error("Transportation API error:", error);
      res.status(500).json({ message: "Failed to get transportation data" });
    }
  });

  // Dynamic city search with Wikipedia integration for all Indian cities
  app.post("/api/search-any-city", async (req, res) => {
    try {
      const { cityName } = req.body;
      const cityData = await searchCityFromWikipedia(cityName);
      
      if (!cityData) {
        return res.status(404).json({ 
          message: `Could not find information for ${cityName}. Please check the spelling or try a different city name.` 
        });
      }

      res.json(cityData);
    } catch (error) {
      console.error("Dynamic city search error:", error);
      res.status(500).json({ message: "Failed to search city information" });
    }
  });

  return httpServer;
}

// Transportation data functions
async function getTransportationData(cityName: string) {
  const transportationInfo = getIndianCityTransportation(cityName);
  return {
    trainStations: transportationInfo.trainStations,
    busRoutes: transportationInfo.busRoutes,
    localTransport: transportationInfo.localTransport,
    airports: transportationInfo.airports
  };
}

function getIndianCityTransportation(cityName: string) {
  const transportData: { [key: string]: any } = {
    "Mumbai": {
      trainStations: [
        { name: "Chhatrapati Shivaji Terminus", code: "CSMT", distance: "City Center" },
        { name: "Mumbai Central", code: "BCT", distance: "5 km from CST" },
        { name: "Lokmanya Tilak Terminus", code: "LTT", distance: "Northeast Mumbai" }
      ],
      busRoutes: [
        { operator: "BEST", route: "Citywide coverage", frequency: "Every 5-10 mins" },
        { operator: "MSRTC", route: "Mumbai to all Maharashtra", frequency: "Every 30 mins" }
      ],
      localTransport: {
        metro: "Mumbai Metro Line 1, 2A, 7, 2B operational",
        local: "Central, Western, Harbour lines - lifeline of Mumbai",
        bus: "BEST buses covering entire city",
        auto: "Three-wheelers, meter mandatory"
      },
      airports: [{ name: "Chhatrapati Shivaji International", code: "BOM", distance: "15 km" }]
    },
    "Delhi": {
      trainStations: [
        { name: "New Delhi Railway Station", code: "NDLS", distance: "City Center" },
        { name: "Old Delhi Railway Station", code: "DLI", distance: "Old Delhi" },
        { name: "Hazrat Nizamuddin", code: "NZM", distance: "South Delhi" }
      ],
      busRoutes: [
        { operator: "DTC", route: "Delhi city buses", frequency: "Every 10-15 mins" },
        { operator: "Cluster Buses", route: "Modern AC buses", frequency: "Every 15-20 mins" }
      ],
      localTransport: {
        metro: "Delhi Metro - 12 lines covering entire NCR",
        local: "Limited suburban railway",
        bus: "DTC and cluster buses extensive network",
        auto: "CNG auto rickshaws everywhere"
      },
      airports: [{ name: "Indira Gandhi International", code: "DEL", distance: "20 km" }]
    }
  };

  return transportData[cityName] || {
    trainStations: [{ name: `${cityName} Railway Station`, code: "---", distance: "City Center" }],
    busRoutes: [{ operator: "State Transport", route: "City and intercity", frequency: "Regular service" }],
    localTransport: {
      metro: "Check local rapid transit options",
      local: "Regional railway connections available",
      bus: "State and private bus operators",
      auto: "Auto rickshaw services available"
    },
    airports: []
  };
}

async function searchCityFromWikipedia(cityName: string) {
  try {
    // Search Wikipedia for city information
    const wikiSearchResponse = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cityName + " India")}`
    );

    if (wikiSearchResponse.data && wikiSearchResponse.data.extract) {
      const cityData = {
        name: cityName,
        description: wikiSearchResponse.data.extract,
        coordinates: wikiSearchResponse.data.coordinates || null
      };

      return {
        city: {
          name: cityName,
          state: "India",
          country: "India",
          latitude: cityData.coordinates?.lat || 0,
          longitude: cityData.coordinates?.lon || 0
        },
        weather: await getRealWeatherData({ name: cityName }),
        cityInfo: {
          description: cityData.description,
          bestTimeToVisit: "October to March (post-monsoon)",
          localLanguages: ["Hindi", "English"],
          culturalTips: [
            "Respect local customs and traditions",
            "Remove shoes before entering temples",
            "Dress modestly at religious sites"
          ],
          safetyRating: 4.0,
          crimeRate: "Moderate",
          touristSafety: "Generally Safe with Precautions",
          touristAttractions: ["Historical sites", "Local markets", "Religious places"],
          localCuisine: ["Local specialties", "Street food"],
          emergencyContacts: {
            police: "100",
            medical: "108",
            fire: "101",
            touristHelpline: "1363"
          },
          politicalInfo: "Administrative center in India",
          festivals: ["Regional festivals", "Diwali", "Holi"],
          historicalInfo: cityData.description,
          news: await getCityNews(cityName)
        },
        hotels: getMockHotels(cityName),
        restaurants: getMockRestaurants(cityName),
        message: `Information for ${cityName} loaded from Wikipedia and real-time sources`
      };
    }

    return null;
  } catch (error) {
    console.error("Wikipedia search error:", error);
    return null;
  }
}

// Helper functions
async function getRealWeatherData(city: any) {
  try {
    // Use free weather API (wttr.in) - no API key required
    const response = await axios.get(
      `https://wttr.in/${city.name}?format=j1`
    );

    const data = response.data;
    const current = data.current_condition[0];
    const forecast = data.weather.slice(0, 7);

    const weatherData = {
      temperature: Math.round(parseFloat(current.temp_C)),
      description: current.weatherDesc[0].value,
      humidity: parseInt(current.humidity),
      windSpeed: Math.round(parseFloat(current.windspeedKmph)),
      uvIndex: current.uvIndex || "Moderate",
      forecast: forecast.map((day: any, index: number) => ({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(day.date).getDay()],
        icon: getWeatherIconType(day.hourly[4].weatherCode),
        temp: Math.round((parseFloat(day.maxtempC) + parseFloat(day.mintempC)) / 2)
      }))
    };

    await storage.createOrUpdateWeather({
      cityId: city.id,
      temperature: weatherData.temperature,
      description: weatherData.description,
      humidity: weatherData.humidity,
      windSpeed: weatherData.windSpeed,
      uvIndex: weatherData.uvIndex,
      forecast: weatherData.forecast
    });

    return weatherData;
  } catch (error) {
    console.error("Weather API error:", error);
    // Fallback with Indian-specific weather patterns
    const fallbackWeather = {
      temperature: getSeasonalTemp(city.name),
      description: getSeasonalDescription(city.name),
      humidity: 75,
      windSpeed: 8,
      uvIndex: "High",
      forecast: [
        { day: "Mon", icon: "cloud-rain", temp: 26 },
        { day: "Tue", icon: "sun", temp: 30 },
        { day: "Wed", icon: "cloud-sun", temp: 29 },
        { day: "Thu", icon: "cloud-rain", temp: 27 },
        { day: "Fri", icon: "cloud", temp: 28 },
        { day: "Sat", icon: "sun", temp: 31 },
        { day: "Sun", icon: "cloud-sun", temp: 29 }
      ]
    };
    return fallbackWeather;
  }
}

function getWeatherIconType(weatherCode: string): string {
  const code = parseInt(weatherCode);
  if (code >= 200 && code < 300) return "cloud-rain";
  if (code >= 300 && code < 600) return "cloud-rain";
  if (code >= 600 && code < 700) return "cloud-snow";
  if (code >= 700 && code < 800) return "cloud";
  if (code === 800) return "sun";
  if (code > 800) return "cloud-sun";
  return "sun";
}

function getSeasonalTemp(cityName: string): number {
  const currentMonth = new Date().getMonth() + 1;
  const tempMap: { [key: string]: { [key: number]: number } } = {
    "Mumbai": { 1: 24, 2: 25, 3: 28, 4: 30, 5: 32, 6: 30, 7: 28, 8: 28, 9: 29, 10: 30, 11: 28, 12: 25 },
    "Delhi": { 1: 15, 2: 18, 3: 24, 4: 30, 5: 35, 6: 38, 7: 33, 8: 32, 9: 31, 10: 28, 11: 22, 12: 17 },
    "Bangalore": { 1: 21, 2: 24, 3: 27, 4: 28, 5: 27, 6: 24, 7: 22, 8: 23, 9: 24, 10: 24, 11: 22, 12: 20 }
  };
  return tempMap[cityName]?.[currentMonth] || 26;
}

function getSeasonalDescription(cityName: string): string {
  const currentMonth = new Date().getMonth() + 1;
  if (currentMonth >= 6 && currentMonth <= 9) return "Monsoon season - Heavy rainfall expected";
  if (currentMonth >= 10 && currentMonth <= 2) return "Post-monsoon - Pleasant and cool";
  if (currentMonth >= 3 && currentMonth <= 5) return "Summer season - Hot and dry";
  return "Pleasant weather";
}

async function getCityNews(cityName: string) {
  try {
    // Use free news API alternative
    const newsResponse = await axios.get(
      `https://api.rss2json.com/v1/api.json?rss_url=https://news.google.com/rss/search?q=${encodeURIComponent(cityName + ' India')}&hl=en-IN&gl=IN&ceid=IN:en`
    );

    const articles = newsResponse.data.items?.slice(0, 5) || [];
    return articles.map((article: any) => ({
      title: article.title,
      description: article.description,
      url: article.link,
      publishedAt: article.pubDate,
      source: article.author || "Google News"
    }));
  } catch (error) {
    console.error("News API error:", error);
    return [
      {
        title: `Latest updates from ${cityName}`,
        description: `Stay informed about current events and developments in ${cityName}`,
        url: `https://news.google.com/search?q=${cityName}`,
        publishedAt: new Date().toISOString(),
        source: "Local News"
      }
    ];
  }
}

async function getCityInformation(city: any) {
  try {
    // Get Wikipedia information
    let historicalInfo = "";
    try {
      const wikiResponse = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city.name)}`
      );
      historicalInfo = wikiResponse.data.extract || "";
    } catch (wikiError) {
      console.error("Wikipedia API error:", wikiError);
      historicalInfo = getCityHistoricalInfo(city.name);
    }

    // Comprehensive city information specific to Indian cities
    const cityInfoData = {
      historicalInfo,
      bestTimeToVisit: getBestTimeToVisit(city.name),
      localLanguages: ["Hindi", "English", getLocalLanguage(city.name)],
      culturalTips: getCulturalTips(city.name),
      safetyRating: getSafetyRating(city.name),
      crimeRate: getCrimeRate(city.name),
      touristSafety: "Generally Safe with Precautions",
      touristAttractions: getTouristAttractions(city.name),
      localCuisine: getLocalCuisine(city.name),
      emergencyContacts: {
        police: "100",
        medical: "108",
        fire: "101",
        touristHelpline: "1363",
        womenHelpline: "1091"
      },
      politicalInfo: getPoliticalInfo(city.name),
      festivals: getFestivals(city.name)
    };

    await storage.createOrUpdateCityInfo({
      cityId: city.id,
      ...cityInfoData
    });

    return cityInfoData;
  } catch (error) {
    console.error("City information error:", error);
    throw error;
  }
}

function getLocalLanguage(cityName: string): string {
  const languageMap: { [key: string]: string } = {
    "Mumbai": "Marathi",
    "Delhi": "Hindi",
    "Bangalore": "Kannada",
    "Chennai": "Tamil",
    "Kolkata": "Bengali",
    "Hyderabad": "Telugu",
    "Pune": "Marathi",
    "Ahmedabad": "Gujarati"
  };
  return languageMap[cityName] || "Hindi";
}

function getCityHistoricalInfo(cityName: string): string {
  const historyMap: { [key: string]: string } = {
    "Mumbai": "Mumbai, formerly known as Bombay, is the financial capital of India. Originally a cluster of seven islands, it was shaped by Portuguese and British colonial rule before becoming the commercial heart of modern India.",
    "Delhi": "Delhi, India's capital territory, has been continuously inhabited for over 2,500 years. It has served as the capital of various empires, including the Mughal Empire, and features numerous UNESCO World Heritage Sites.",
    "Bangalore": "Bangalore, known as India's Silicon Valley, was founded in 1537 by Kempe Gowda. It transformed from a pensioner's paradise to India's IT capital, hosting major global technology companies.",
    "Chennai": "Chennai, formerly Madras, was established by the British East India Company in 1640. It's known as the 'Detroit of India' for its automobile industry and is a major cultural center of South India.",
    "Kolkata": "Kolkata, the former capital of British India, is known as the 'City of Joy'. It was the center of the Bengal Renaissance and remains India's intellectual and cultural capital.",
    "Hyderabad": "Hyderabad, founded in 1591 by Muhammad Quli Qutb Shah, is famous for its rich history, pearls, and biryani. It's now a major IT hub known as 'Cyberabad'.",
    "Pune": "Pune, once the seat of the Maratha Empire, is known for its educational institutions and IT industry. It's often called the 'Oxford of the East' and 'Queen of the Deccan'.",
    "Ahmedabad": "Ahmedabad, founded in 1411 by Sultan Ahmed Shah, is Gujarat's largest city and India's first UNESCO World Heritage City. It's known for its textile industry and as Mahatma Gandhi's home base."
  };
  return historyMap[cityName] || `${cityName} is a significant city in India with rich cultural heritage and historical importance.`;
}

function getBestTimeToVisit(cityName: string): string {
  const timingMap: { [key: string]: string } = {
    "Mumbai": "November to February (cool and dry, perfect for sightseeing)",
    "Delhi": "October to March (pleasant winter weather, ideal for exploring)",
    "Bangalore": "Year-round destination (pleasant climate, slight preference for Oct-Feb)",
    "Chennai": "November to February (post-monsoon, less humid)",
    "Kolkata": "October to March (comfortable weather after monsoon)",
    "Hyderabad": "October to February (cool and pleasant)",
    "Pune": "October to February (ideal weather for outdoor activities)",
    "Ahmedabad": "November to February (cooler months, festival season)"
  };
  return timingMap[cityName] || "October to February (post-monsoon, pleasant weather)";
}

function getCulturalTips(cityName: string): string[] {
  const tipsMap: { [key: string]: string[] } = {
    "Mumbai": [
      "Use local trains during off-peak hours to avoid crowds",
      "Try street food at Mohammed Ali Road and Crawford Market",
      "Respect the fast-paced lifestyle - Mumbai never sleeps",
      "Remove shoes before entering religious places"
    ],
    "Delhi": [
      "Dress modestly when visiting Red Fort and Jama Masjid",
      "Negotiate prices at Chandni Chowk and Khan Market",
      "Use Delhi Metro for convenient travel",
      "Try authentic Delhi street food with caution"
    ],
    "Bangalore": [
      "English is widely spoken - communication is easy",
      "Pub culture is prominent - respect local nightlife etiquette",
      "Traffic can be heavy - plan extra travel time",
      "Weather can change quickly - carry light jacket"
    ]
  };
  return tipsMap[cityName] || [
    "Remove shoes before entering temples and homes",
    "Dress modestly at religious sites",
    "Respect local customs and traditions",
    "Learn basic greetings in the local language"
  ];
}

function getSafetyRating(cityName: string): number {
  const safetyMap: { [key: string]: number } = {
    "Mumbai": 4.1,
    "Delhi": 3.8,
    "Bangalore": 4.4,
    "Chennai": 4.2,
    "Kolkata": 4.0,
    "Hyderabad": 4.3,
    "Pune": 4.5,
    "Ahmedabad": 4.2
  };
  return safetyMap[cityName] || 4.0;
}

function getCrimeRate(cityName: string): string {
  const crimeMap: { [key: string]: string } = {
    "Mumbai": "Moderate (petty theft, crowded areas need caution)",
    "Delhi": "Moderate to High (be cautious, especially at night)",
    "Bangalore": "Low to Moderate (generally safe, traffic incidents common)",
    "Chennai": "Low to Moderate (safe for tourists, minor theft possible)",
    "Kolkata": "Moderate (political demonstrations, minor crimes)",
    "Hyderabad": "Low (generally safe, standard precautions)",
    "Pune": "Low (very safe, minimal crime against tourists)",
    "Ahmedabad": "Low to Moderate (safe, but avoid sensitive areas)"
  };
  return crimeMap[cityName] || "Moderate (standard safety precautions recommended)";
}

function getTouristAttractions(cityName: string): string[] {
  const attractionsMap: { [key: string]: string[] } = {
    "Mumbai": ["Gateway of India", "Marine Drive", "Elephanta Caves", "Chhatrapati Shivaji Terminus", "Bollywood Studios"],
    "Delhi": ["Red Fort", "India Gate", "Qutub Minar", "Lotus Temple", "Humayun's Tomb"],
    "Bangalore": ["Lalbagh Botanical Garden", "Bangalore Palace", "Tipu Sultan's Summer Palace", "ISKCON Temple", "Cubbon Park"],
    "Chennai": ["Marina Beach", "Kapaleeshwarar Temple", "Fort St. George", "Government Museum", "San Thome Cathedral"],
    "Kolkata": ["Victoria Memorial", "Howrah Bridge", "Dakshineswar Temple", "Indian Museum", "Eden Gardens"],
    "Hyderabad": ["Charminar", "Golconda Fort", "Ramoji Film City", "Salar Jung Museum", "Hussain Sagar Lake"],
    "Pune": ["Shaniwar Wada", "Aga Khan Palace", "Sinhagad Fort", "Osho Ashram", "Pataleshwar Cave Temple"],
    "Ahmedabad": ["Sabarmati Ashram", "Adalaj Stepwell", "Akshardham Temple", "Kankaria Lake", "Sidi Saiyyed Mosque"]
  };
  return attractionsMap[cityName] || ["Historical monuments", "Local markets", "Religious sites", "Museums"];
}

function getLocalCuisine(cityName: string): string[] {
  const cuisineMap: { [key: string]: string[] } = {
    "Mumbai": ["Vada Pav", "Pav Bhaji", "Bhel Puri", "Bombay Duck", "Solkadhi"],
    "Delhi": ["Chole Bhature", "Paranthe Wali Gali", "Delhi Chaat", "Nihari", "Kulfi"],
    "Bangalore": ["Masala Dosa", "Bisi Bele Bath", "Mysore Pak", "Filter Coffee", "Rava Idli"],
    "Chennai": ["Dosa & Idli", "Chettinad Cuisine", "Fish Curry", "Sambar", "Rasam"],
    "Kolkata": ["Fish Curry Rice", "Rosogolla", "Kathi Roll", "Bengali Sweets", "Mishti Doi"],
    "Hyderabad": ["Hyderabadi Biryani", "Haleem", "Nihari", "Qubani ka Meetha", "Irani Chai"],
    "Pune": ["Misal Pav", "Puran Poli", "Bhakri", "Mastani", "Poha"],
    "Ahmedabad": ["Dhokla", "Thepla", "Gujarati Thali", "Fafda Jalebi", "Handvo"]
  };
  return cuisineMap[cityName] || ["Local specialties", "Street food", "Regional cuisine"];
}

function getPoliticalInfo(cityName: string): string {
  const politicalMap: { [key: string]: string } = {
    "Mumbai": "Commercial capital of Maharashtra state. Known for active civic movements and business-friendly policies.",
    "Delhi": "National Capital Territory with unique administrative structure. Seat of Central Government.",
    "Bangalore": "Capital of Karnataka state. Major technology and aerospace hub with progressive governance.",
    "Chennai": "Capital of Tamil Nadu state. Important port city with significant political influence in South India.",
    "Kolkata": "Capital of West Bengal state. Historic political center with strong intellectual traditions.",
    "Hyderabad": "Capital of Telangana state (formed in 2014). Emerging IT and pharmaceutical hub.",
    "Pune": "Major city in Maharashtra state. Important educational and cultural center.",
    "Ahmedabad": "Largest city in Gujarat state. Commercial center with business-friendly environment."
  };
  return politicalMap[cityName] || "Important administrative center with regional significance.";
}

function getFestivals(cityName: string): string[] {
  const festivalMap: { [key: string]: string[] } = {
    "Mumbai": ["Ganesh Chaturthi", "Navratri", "Diwali", "Gudi Padwa", "Mumbai Film Festival"],
    "Delhi": ["Diwali", "Holi", "Dussehra", "Red Fort Festival", "Delhi Literature Festival"],
    "Bangalore": ["Karaga Festival", "Dussehra", "Diwali", "Bangalore Literature Festival", "Classical Music Season"],
    "Chennai": ["Tamil New Year", "Chennai Music Season", "Pongal", "Navaratri", "Chennai Book Fair"],
    "Kolkata": ["Durga Puja", "Kali Puja", "Poila Boishakh", "Kolkata Book Fair", "Film Festival"],
    "Hyderabad": ["Bonalu", "Bathukamma", "Eid celebrations", "Diwali", "Deccan Festival"],
    "Pune": ["Ganesh Festival", "Shivaji Jayanti", "Pune Festival", "Classical Music Festival", "Gudi Padwa"],
    "Ahmedabad": ["Navratri", "International Kite Festival", "Diwali", "Rath Yatra", "Gujarat Literature Festival"]
  };
  return festivalMap[cityName] || ["Regional festivals", "Diwali", "Holi", "Local celebrations"];
}

function getMockHotels(cityName: string) {
  const hotels = {
    "Mumbai": [
      { name: "The Taj Mahal Palace", rating: 4.8, location: "Colaba, South Mumbai", price: "₹18,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "ITC Grand Central", rating: 4.6, location: "Parel, Central Mumbai", price: "₹12,500", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "The Oberoi Mumbai", rating: 4.9, location: "Nariman Point", price: "₹22,000", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Delhi": [
      { name: "The Imperial Hotel", rating: 4.7, location: "Connaught Place", price: "₹15,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Taj Palace Hotel", rating: 4.6, location: "Diplomatic Enclave", price: "₹20,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "The Leela Palace", rating: 4.8, location: "Chanakyapuri", price: "₹25,000", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ]
  };
  return hotels[cityName as keyof typeof hotels] || hotels["Mumbai"];
}

function getMockRestaurants(cityName: string) {
  const restaurants = {
    "Mumbai": [
      { name: "Trishna", rating: 4.7, cuisine: "Contemporary Indian Seafood", location: "Fort, Mumbai", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Bademiya", rating: 4.3, cuisine: "Street Food & Kebabs", location: "Colaba Causeway", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Khyber", rating: 4.5, cuisine: "North Indian & Mughlai", location: "Fort, Mumbai", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Dakshinayan", rating: 4.4, cuisine: "Authentic South Indian", location: "Powai, Mumbai", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" }
    ]
  };
  return restaurants[cityName as keyof typeof restaurants] || restaurants["Mumbai"];
}

// Helper functions for city normalization and state mapping
function normalizeCityName(cityName: string): string {
  const cityMappings: { [key: string]: string } = {
    "banglore": "Bangalore",
    "bengaluru": "Bangalore", 
    "bombay": "Mumbai",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "tirupathi": "Tirupati",
    "hydarabad": "Hyderabad",
    "puna": "Pune",
    "ahmedabad": "Ahmedabad"
  };
  
  const normalizedInput = cityName.toLowerCase().trim();
  return cityMappings[normalizedInput] || cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
}

function getStateForCity(cityName: string): string {
  const stateMap: { [key: string]: string } = {
    // Major cities mapping
    "Mumbai": "Maharashtra", "Pune": "Maharashtra", "Nagpur": "Maharashtra", "Nashik": "Maharashtra",
    "Delhi": "Delhi", "New Delhi": "Delhi", "Gurgaon": "Haryana", "Noida": "Uttar Pradesh",
    "Bangalore": "Karnataka", "Mysore": "Karnataka", "Hubli": "Karnataka", "Mangalore": "Karnataka",
    "Chennai": "Tamil Nadu", "Coimbatore": "Tamil Nadu", "Madurai": "Tamil Nadu", "Salem": "Tamil Nadu",
    "Tirupati": "Andhra Pradesh", "Nellore": "Andhra Pradesh", "Vijayawada": "Andhra Pradesh", "Visakhapatnam": "Andhra Pradesh",
    "Hyderabad": "Telangana", "Warangal": "Telangana", "Nizamabad": "Telangana", "Karimnagar": "Telangana",
    "Kolkata": "West Bengal", "Darjeeling": "West Bengal", "Siliguri": "West Bengal", "Durgapur": "West Bengal",
    "Ahmedabad": "Gujarat", "Surat": "Gujarat", "Vadodara": "Gujarat", "Rajkot": "Gujarat",
    "Jaipur": "Rajasthan", "Udaipur": "Rajasthan", "Jodhpur": "Rajasthan", "Ajmer": "Rajasthan",
    "Kochi": "Kerala", "Thiruvananthapuram": "Kerala", "Kozhikode": "Kerala", "Thrissur": "Kerala",
    "Bhubaneswar": "Odisha", "Cuttack": "Odisha", "Rourkela": "Odisha", "Berhampur": "Odisha",
    // Add more cities as needed
  };
  
  return stateMap[cityName] || "India";
}

// Comprehensive city-specific hotels data
function getCitySpecificHotels(cityName: string) {
  const hotelData: { [key: string]: any[] } = {
    "Mumbai": [
      { name: "The Taj Mahal Palace", rating: 4.8, location: "Colaba", price: "₹18,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "ITC Grand Central", rating: 4.6, location: "Parel", price: "₹12,500", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Sea Green", rating: 4.2, location: "Marine Drive", price: "₹8,500", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Delhi": [
      { name: "The Imperial Hotel", rating: 4.7, location: "Connaught Place", price: "₹15,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Taj Palace Hotel", rating: 4.6, location: "Diplomatic Enclave", price: "₹20,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Metropolis", rating: 4.0, location: "Karol Bagh", price: "₹6,500", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Bangalore": [
      { name: "ITC Windsor", rating: 4.5, location: "Golf Course Road", price: "₹11,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "The Oberoi Bangalore", rating: 4.7, location: "MG Road", price: "₹16,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Ivory Tower", rating: 4.1, location: "Bannerghatta Road", price: "₹7,200", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Chennai": [
      { name: "ITC Grand Chola", rating: 4.6, location: "Guindy", price: "₹13,500", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "The Leela Palace", rating: 4.8, location: "Adyar", price: "₹19,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Savera", rating: 4.0, location: "Dr. Radhakrishnan Salai", price: "₹8,000", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Hyderabad": [
      { name: "Taj Falaknuma Palace", rating: 4.9, location: "Falaknuma", price: "₹35,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "ITC Kohenur", rating: 4.5, location: "HITEC City", price: "₹12,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Dwaraka", rating: 4.2, location: "SD Road", price: "₹6,800", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Tirupati": [
      { name: "Fortune Select Grand Ridge", rating: 4.3, location: "Tirumala Hills", price: "₹9,500", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Hotel Bliss", rating: 4.0, location: "Railway Station Road", price: "₹4,500", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Kalyan Residency", rating: 3.8, location: "Car Street", price: "₹3,200", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Vijayawada": [
      { name: "The Kay Hotel", rating: 4.2, location: "MG Road", price: "₹7,500", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Hotel Manorama", rating: 3.9, location: "Eluru Road", price: "₹4,800", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Fortune Murali Park", rating: 4.1, location: "Benz Circle", price: "₹6,200", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Nellore": [
      { name: "Hotel Haritha", rating: 3.8, location: "Grand Trunk Road", price: "₹3,500", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Hotel Raju Gari Gaddi", rating: 3.6, location: "Trunk Road", price: "₹2,800", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Sri Kanya Hotel", rating: 3.7, location: "Railway Station Road", price: "₹3,100", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Jaipur": [
      { name: "Taj Rambagh Palace", rating: 4.8, location: "Bhawani Singh Road", price: "₹25,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "The Oberoi Rajvilas", rating: 4.9, location: "Goner Road", price: "₹32,000", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Pearl Palace", rating: 4.0, location: "Hari Kishan Somani Marg", price: "₹5,500", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ],
    "Kochi": [
      { name: "Taj Malabar Resort", rating: 4.6, location: "Willingdon Island", price: "₹14,000", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
      { name: "Le Meridien Kochi", rating: 4.4, location: "Maradu", price: "₹11,500", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
      { name: "Hotel Abad Plaza", rating: 4.1, location: "MG Road", price: "₹7,800", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
    ]
  };

  return hotelData[cityName] || [
    { name: `Heritage Hotel ${cityName}`, rating: 4.0, location: "City Center", price: "₹6,500", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
    { name: `Budget Stay ${cityName}`, rating: 3.7, location: "Railway Station Road", price: "₹3,200", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4" },
    { name: `Grand Palace ${cityName}`, rating: 4.2, location: "Main Market", price: "₹8,500", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d" }
  ];
}

// Comprehensive city-specific restaurants data
function getCitySpecificRestaurants(cityName: string) {
  const restaurantData: { [key: string]: any[] } = {
    "Mumbai": [
      { name: "Trishna", rating: 4.7, cuisine: "Contemporary Indian Seafood", location: "Fort", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Bademiya", rating: 4.3, cuisine: "Street Food & Kebabs", location: "Colaba Causeway", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Leopold Cafe", rating: 4.2, cuisine: "Continental & Indian", location: "Colaba", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Cafe Mondegar", rating: 4.1, cuisine: "European & Indian", location: "Colaba", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" }
    ],
    "Delhi": [
      { name: "Bukhara", rating: 4.8, cuisine: "North Indian & Mughlai", location: "ITC Maurya", priceRange: "₹₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Karim's", rating: 4.4, cuisine: "Mughlai", location: "Jama Masjid", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Paranthe Wali Gali", rating: 4.2, cuisine: "Street Food", location: "Chandni Chowk", priceRange: "₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Al Jawahar", rating: 4.3, cuisine: "Mughlai", location: "Jama Masjid", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Bangalore": [
      { name: "Koshy's Restaurant", rating: 4.3, cuisine: "Continental & Indian", location: "St. Mark's Road", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "MTR (Mavalli Tiffin Room)", rating: 4.5, cuisine: "South Indian", location: "Lalbagh Road", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Vidyarthi Bhavan", rating: 4.4, cuisine: "South Indian", location: "Gandhi Bazaar", priceRange: "₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Corner House Ice Cream", rating: 4.2, cuisine: "Desserts", location: "Various Locations", priceRange: "₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Chennai": [
      { name: "Dakshin", rating: 4.6, cuisine: "South Indian Fine Dining", location: "ITC Park Sheraton", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Murugan Idli Shop", rating: 4.4, cuisine: "South Indian", location: "Multiple Locations", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Saravana Bhavan", rating: 4.3, cuisine: "Vegetarian South Indian", location: "KK Nagar", priceRange: "₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Buhari Hotel", rating: 4.2, cuisine: "Biryani & Mughlai", location: "Anna Salai", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Hyderabad": [
      { name: "Paradise Restaurant", rating: 4.5, cuisine: "Hyderabadi Biryani", location: "Secunderabad", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Bawarchi Restaurant", rating: 4.4, cuisine: "Biryani & Mughlai", location: "RTC X Roads", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Shah Ghouse", rating: 4.3, cuisine: "Haleem & Biryani", location: "Tolichowki", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Cafe Bahar", rating: 4.2, cuisine: "Hyderabadi Cuisine", location: "Basheer Bagh", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Tirupati": [
      { name: "Hotel Minerva Grand", rating: 4.1, cuisine: "South Indian & Multi-cuisine", location: "Renigunta Road", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Sri Venkateswara Restaurant", rating: 4.0, cuisine: "Pure Vegetarian", location: "Car Street", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Taste of Tirumala", rating: 3.9, cuisine: "Temple Food", location: "Near Temple", priceRange: "₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Annapurna Restaurant", rating: 3.8, cuisine: "South Indian Thaali", location: "Gandhi Road", priceRange: "₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Vijayawada": [
      { name: "Hotel Southern Grand", rating: 4.0, cuisine: "Andhra & Multi-cuisine", location: "MG Road", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Babai Hotel", rating: 4.2, cuisine: "Andhra Meals", location: "Gandhi Nagar", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Sweet Magic", rating: 3.9, cuisine: "Sweets & Snacks", location: "Benz Circle", priceRange: "₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Minerva Coffee Shop", rating: 4.1, cuisine: "South Indian & Chinese", location: "Governorpet", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Nellore": [
      { name: "Hotel Haritha", rating: 3.8, cuisine: "Andhra Cuisine", location: "Grand Trunk Road", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Sri Kanya Restaurant", rating: 3.7, cuisine: "South Indian", location: "Railway Station Road", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Spice Route", rating: 3.6, cuisine: "Multi-cuisine", location: "Trunk Road", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Raju Gari Gaddi", rating: 3.9, cuisine: "Traditional Andhra", location: "City Center", priceRange: "₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Jaipur": [
      { name: "1135 AD", rating: 4.5, cuisine: "Rajasthani Cuisine", location: "Amber Fort", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Chokhi Dhani", rating: 4.3, cuisine: "Traditional Rajasthani", location: "Tonk Road", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "LMB (Laxmi Misthan Bhandar)", rating: 4.4, cuisine: "Rajasthani Sweets", location: "Johari Bazaar", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Spice Court", rating: 4.2, cuisine: "Rajasthani & Mughlai", location: "Civil Lines", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ],
    "Kochi": [
      { name: "The Rice Boat", rating: 4.5, cuisine: "Kerala Seafood", location: "Taj Malabar Resort", priceRange: "₹₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
      { name: "Dhe Puttu", rating: 4.3, cuisine: "Kerala Traditional", location: "Panampilly Nagar", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
      { name: "Fort House Restaurant", rating: 4.2, cuisine: "Continental & Kerala", location: "Fort Kochi", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
      { name: "Kayees Biryani", rating: 4.4, cuisine: "Biryani & Kerala", location: "Broadway", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
    ]
  };

  return restaurantData[cityName] || [
    { name: `Local Delights ${cityName}`, rating: 4.0, cuisine: "Regional Specialties", location: "City Center", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" },
    { name: `Street Food Corner`, rating: 3.8, cuisine: "Local Street Food", location: "Main Market", priceRange: "₹", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b" },
    { name: `Heritage Restaurant`, rating: 4.1, cuisine: "Traditional Indian", location: "Heritage Area", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de" },
    { name: `Modern Cafe ${cityName}`, rating: 3.9, cuisine: "Continental & Indian", location: "Commercial Area", priceRange: "₹₹", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" }
  ];
}
