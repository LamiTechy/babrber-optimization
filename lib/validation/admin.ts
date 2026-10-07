import { z } from "zod";

/** `HH:MM` in 24-hour time, as stored in `shop_hours`. */
const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:00 or 21:30");

export const hoursRangeSchema = z
  .object({
    open: clock,
    close: clock,
  })
  .refine((range) => range.open !== range.close, {
    message: "Opening and closing time cannot be identical",
    path: ["close"],
  });

/** One day = 0..4 ranges. An empty array means closed that day. */
export const dayHoursSchema = z.array(hoursRangeSchema).max(4);

/** Sunday first, matching the database convention. */
export const weekHoursSchema = z.array(dayHoursSchema).length(7);

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  priceNaira: z
    .number({ error: "Price is required" })
    .int("Price must be a whole naira amount")
    .min(0)
    .max(1_000_000),
  durationMinutes: z
    .number()
    .int()
    .min(0)
    .max(600)
    .nullable()
    .optional()
    .default(null),
});

export const servicesSchema = z.array(serviceSchema).max(30);

export const coordinatesSchema = {
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

export const shopFieldsSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  description: z.string().trim().max(1200).nullable().optional().default(null),
  address: z.string().trim().max(160).nullable().optional().default(null),
  landmarkNote: z.string().trim().max(200).nullable().optional().default(null),
  ...coordinatesSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{6,20}$/, "Enter a phone number like +234 805 000 0000")
    .nullable()
    .optional()
    .default(null),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "WhatsApp number needs 10–15 digits, no spaces")
    .nullable()
    .optional()
    .default(null),
  amenities: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  isPublished: z.boolean().default(true),
  hoursSource: z.enum(["manual", "unknown", "osm"]).default("manual"),
});

export const createShopSchema = shopFieldsSchema;

export const updateShopSchema = shopFieldsSchema.extend({
  overrideStatus: z.enum(["open", "closed"]).nullable().default(null),
  overrideUntil: z.iso.datetime().nullable().default(null),
});

export const loginSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(1, "Password is required").max(200),
});

export type ShopFieldsInput = z.infer<typeof shopFieldsSchema>;
export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
