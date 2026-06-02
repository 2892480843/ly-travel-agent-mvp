const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
let cookie = "";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers ?? {})
    }
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const health = await request("/api/health");
const login = await request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ role: "visitor", password: "sandbox" })
});
const options = await request("/api/tickets/options?poiId=ticket-leifeng-demo&visitDate=2026-06-06");
const product = options.products[0];
const slot = options.slots[0];
const lock = await request("/api/tickets/lock", {
  method: "POST",
  body: JSON.stringify({ productId: product.id, slotId: slot.id, visitDate: "2026-06-06", quantity: 1 })
});
const order = await request("/api/orders", {
  method: "POST",
  body: JSON.stringify({
    title: `雷峰塔 ${product.name} x1`,
    poiId: "ticket-leifeng-demo",
    ticketId: product.id,
    ticketName: product.name,
    slotId: slot.id,
    slotTime: slot.time,
    visitDate: "2026-06-06",
    quantity: 1,
    amount: product.price + 30,
    lockId: lock.id,
    visitorInfo: [{ name: "张小文", credentialType: "id-card", credentialNo: "330***********1234" }]
  })
});
const payment = await request("/api/payments/create", {
  method: "POST",
  body: JSON.stringify({ orderId: order.id, provider: "sandbox" })
});
const paidPayment = await request(`/api/payments/${payment.id}/sandbox`, {
  method: "POST",
  body: JSON.stringify({ status: "paid" })
});
const orders = await request("/api/orders");
const route = await request("/api/maps/route", {
  method: "POST",
  body: JSON.stringify({ mode: "walking", preferences: ["少排队", "文化深读"] })
});

console.log(JSON.stringify({
  ok: true,
  service: health.service,
  user: login.user.role,
  orderId: order.id,
  paymentStatus: paidPayment.status,
  orderCount: orders.length,
  routeProvider: route.provider,
  routeFallback: route.fallback
}, null, 2));
