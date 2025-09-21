import { apiGet, apiPatch } from "./api";

export type KitchenStatus = "PENDING" | "COMPLETED";

export type KitchenOrderLine = {
  id: number;
  qty: number;
  productId: number;
  name: string;
};

export type KitchenOrder = {
  id: number;
  orderCode: string | null;
  terminalId: string;
  createdAt: string;
  businessDate: string;
  kitchenStatus: KitchenStatus;
  kitchenCompletedAt: string | null;
  items: KitchenOrderLine[];
};

export async function listKitchenOrders(params: {
  date?: string;
  status?: KitchenStatus | "ALL";
  limit?: number;
} = {}) {
  const query = {
    ...(params.date ? { date: params.date } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.limit ? { limit: params.limit } : {}),
  };
  return apiGet<{ orders: KitchenOrder[] }>(`/kitchen/orders`, query);
}

export async function updateKitchenOrderStatus(
  id: number,
  status: KitchenStatus
) {
  return apiPatch<{ order: KitchenOrder }>(`/kitchen/orders/${id}`, {
    kitchenStatus: status,
  });
}
