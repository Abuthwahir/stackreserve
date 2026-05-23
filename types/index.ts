import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

/**
 * Zod validation schema for Product model
 */
export const ProductSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'Product name is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod validation schema for Warehouse model
 */
export const WarehouseSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'Warehouse name is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod validation schema for Inventory model
 */
export const InventorySchema = z.object({
  id: z.string().cuid(),
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  totalStock: z.number().int().nonnegative('Total stock cannot be negative'),
  reservedStock: z.number().int().nonnegative('Reserved stock cannot be negative'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod validation schema for ReservationStatus Enum
 */
export const ReservationStatusSchema = z.nativeEnum(ReservationStatus);

/**
 * Zod validation schema for Reservation model
 */
export const ReservationSchema = z.object({
  id: z.string().cuid(),
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  status: ReservationStatusSchema,
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod validation schema for temporary checkout reservation request input
 */
export const CreateReservationInputSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  warehouseId: z.string().cuid('Invalid warehouse ID'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  expiresInMinutes: z.number().int().positive().default(10),
});

// Infer TS Types from Zod schemas
export type Product = z.infer<typeof ProductSchema>;
export type Warehouse = z.infer<typeof WarehouseSchema>;
export type Inventory = z.infer<typeof InventorySchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type CreateReservationInput = z.infer<typeof CreateReservationInputSchema>;
