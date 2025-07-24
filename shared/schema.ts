import { pgTable, text, serial, integer, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("India"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
});

export const weatherData = pgTable("weather_data", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  temperature: real("temperature").notNull(),
  description: text("description").notNull(),
  humidity: integer("humidity").notNull(),
  windSpeed: real("wind_speed").notNull(),
  uvIndex: text("uv_index").notNull(),
  forecast: json("forecast").notNull(), // Array of forecast data
});

export const cityInfo = pgTable("city_info", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  historicalInfo: text("historical_info").notNull(),
  bestTimeToVisit: text("best_time_to_visit").notNull(),
  localLanguages: text("local_languages").array().notNull(),
  culturalTips: text("cultural_tips").array().notNull(),
  safetyRating: real("safety_rating").notNull(),
  crimeRate: text("crime_rate").notNull(),
  touristSafety: text("tourist_safety").notNull(),
  touristAttractions: text("tourist_attractions").array().notNull(),
  localCuisine: text("local_cuisine").array().notNull(),
  emergencyContacts: json("emergency_contacts").notNull(),
  politicalInfo: text("political_info"),
  festivals: text("festivals").array().notNull(),
});

export const hotels = pgTable("hotels", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  name: text("name").notNull(),
  rating: real("rating").notNull(),
  location: text("location").notNull(),
  price: text("price").notNull(),
  amenities: text("amenities").array().notNull(),
  hotelType: text("hotel_type").notNull(), // heritage, luxury, budget
  imageUrl: text("image_url"),
});

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  name: text("name").notNull(),
  rating: real("rating").notNull(),
  cuisine: text("cuisine").notNull(),
  location: text("location").notNull(),
  priceRange: text("price_range").notNull(),
  specialties: text("specialties").array().notNull(),
  imageUrl: text("image_url"),
});

export const smsRequests = pgTable("sms_requests", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: text("sent_at"),
});

export const insertCitySchema = createInsertSchema(cities).omit({
  id: true,
});

export const insertWeatherDataSchema = createInsertSchema(weatherData).omit({
  id: true,
});

export const insertCityInfoSchema = createInsertSchema(cityInfo).omit({
  id: true,
});

export const insertHotelSchema = createInsertSchema(hotels).omit({
  id: true,
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
});

export const insertSmsRequestSchema = createInsertSchema(smsRequests).omit({
  id: true,
  status: true,
  sentAt: true,
});

export const searchCitySchema = z.object({
  cityName: z.string().min(1, "City name is required"),
});

export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;
export type WeatherData = typeof weatherData.$inferSelect;
export type InsertWeatherData = z.infer<typeof insertWeatherDataSchema>;
export type CityInfo = typeof cityInfo.$inferSelect;
export type InsertCityInfo = z.infer<typeof insertCityInfoSchema>;
export type Hotel = typeof hotels.$inferSelect;
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type SmsRequest = typeof smsRequests.$inferSelect;
export type InsertSmsRequest = z.infer<typeof insertSmsRequestSchema>;
export type SearchCityRequest = z.infer<typeof searchCitySchema>;
