import type { TicketProduct, TicketSlot } from "../types";

export function getDemoTicketOptions(poiId: string): TicketProduct[] {
  return [
    { id: "adult", poiId, name: "成人票", price: 40, desc: "18-60周岁游客", stock: 180, status: "available" },
    { id: "student", poiId, name: "学生票", price: 20, desc: "全日制在校学生", stock: 120, status: "available" },
    { id: "child", poiId, name: "儿童票", price: 20, desc: "6-18周岁未成年人", stock: 80, status: "available" },
    { id: "senior", poiId, name: "老人票", price: 20, desc: "60-70周岁老人", stock: 18, status: "low" },
    { id: "care", poiId, name: "优待票", price: 0, desc: "残疾人/现役军人", stock: 999, status: "verify" }
  ];
}

export function getDemoTicketSlots(): TicketSlot[] {
  return [
    { id: "08-10", time: "08:00-10:00", stock: 120, status: "available" },
    { id: "10-12", time: "10:00-12:00", stock: 92, status: "available" },
    { id: "12-14", time: "12:00-14:00", stock: 16, status: "low" },
    { id: "14-16", time: "14:00-16:00", stock: 22, status: "low" },
    { id: "16-1730", time: "16:00-17:30", stock: 80, status: "available" }
  ];
}

export function validateTicketSelection(product: TicketProduct, slot: TicketSlot, quantity: number) {
  if (quantity <= 0) return "票数必须大于 0";
  if (product.status === "soldOut" || product.stock < quantity) return "当前票种库存不足";
  if (slot.status === "soldOut" || slot.stock < quantity) return "当前时段不可用或库存不足";
  return null;
}
