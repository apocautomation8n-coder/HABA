export interface PriceRecord {
  id: string;
  insumo_id?: string;
  price: number; // Precio unitario de reposición
  date: string; // ISO format (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)
  note?: string; // Proveedor, marca, o motivo del cambio
  supplier?: string;
  created_at?: string;
}

export interface Insumo {
  id: string;
  name: string;
  category: "Alimentos" | "Packaging" | "Otros" | string;
  current_price: number; // Precio actual de reposición
  purchase_unit: string; // kg, g, litro, unidad, metro, etc.
  purchase_quantity?: number;
  recipe_unit?: string;
  updated_at: string;
  history: PriceRecord[];
}
