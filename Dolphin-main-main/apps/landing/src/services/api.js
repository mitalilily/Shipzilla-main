import {
  mockCalculateRates,
  mockLogin,
  mockSubmitContact,
  mockTrackShipment,
} from "./mockApi";
import { buildRateSummary, generateCourierQuotes } from "../utils/calculators";

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";
const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);
const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === "true" || !API_BASE_URL;

function normalizeApiBaseUrl(value) {
  if (!value) return "";

  try {
    const candidate = new URL(value, window.location.origin);
    const normalized = candidate.href.replace(/\/+$/, "");

    if (normalized.endsWith("/api") || normalized.includes("/api/")) {
      return normalized;
    }

    return `${normalized}/api`;
  } catch {
    return "";
  }
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePath(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${normalizePath(path)}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function getPaymentType(formValues) {
  return String(formValues.paymentType || "Prepaid").toLowerCase() === "cod" ? "cod" : "prepaid";
}

function buildRatePayload(formValues) {
  const summary = buildRateSummary(formValues);

  return {
    origin: String(formValues.originPincode || "").trim(),
    destination: String(formValues.destinationPincode || "").trim(),
    payment_type: getPaymentType(formValues),
    order_amount: toNumber(formValues.orderAmount),
    weight: summary.billableWeight,
    length: toNumber(formValues.length),
    breadth: toNumber(formValues.breadth),
    height: toNumber(formValues.height),
    shipment_type: "b2c",
    context: "rate_calculator",
    isCalculator: true,
  };
}

function getFreightAmount(courier) {
  const forward = courier?.localRates?.forward || {};
  return toNumber(courier?.rate ?? forward?.rate ?? courier?.courier_cost_estimate);
}

function getCodAmount(courier, formValues) {
  if (getPaymentType(formValues) !== "cod") return 0;

  const forward = courier?.localRates?.forward || {};
  const orderAmount = toNumber(formValues.orderAmount);
  const fixedCod = toNumber(forward?.cod_charges ?? courier?.cod_charges);
  const codPercent = toNumber(forward?.cod_percent);
  const percentCod = orderAmount > 0 && codPercent > 0 ? (orderAmount * codPercent) / 100 : 0;

  return fixedCod + percentCod;
}

function mapRateOptions(couriers, formValues, summary) {
  return couriers.map((courier, index) => {
    const forward = courier?.localRates?.forward || {};
    const freight = getFreightAmount(courier);
    const codAmount = getCodAmount(courier, formValues);
    const zone = courier?.approxZone?.name || courier?.approxZone?.code || summary.zone.label;
    const mode = forward?.mode || courier?.provider_serviceability?.mode || "";
    const tag = courier?.tag || "";
    const billableWeight = courier?.chargeable_weight
      ? toNumber(courier.chargeable_weight) / 1000
      : summary.billableWeight;

    return {
      id: courier?.courier_option_key || `${courier?.id || "courier"}-${index}`,
      name: courier?.displayName || courier?.name || "Courier option",
      accent:
        tag === "fastest"
          ? "Fastest serviceable option"
          : tag === "economy"
            ? "Best available economy option"
            : "Serviceable courier from your rate card",
      eta: courier?.edd || summary.zone.sla,
      serviceScore: Math.max(76, 96 - index * 4),
      price: Math.round(freight + codAmount),
      zone,
      billableWeight,
      badges: [
        getPaymentType(formValues) === "cod" ? "COD enabled" : "Prepaid lane",
        mode ? `${mode} mode` : "",
        tag ? tag : "",
      ].filter(Boolean),
    };
  });
}

function formatTimelineDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Pending";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveTimelineKey(event, index) {
  const value = `${event?.status_code || ""} ${event?.message || ""}`.toLowerCase();

  if (value.includes("deliver") && !value.includes("out")) return "delivered";
  if (value.includes("ofd") || value.includes("out for delivery")) return "ofd";
  if (value.includes("transit") || value.includes("manifest") || value.includes("shipped")) {
    return "transit";
  }
  if (value.includes("pickup") || value.includes("pending")) return "dispatched";
  if (index === 0) return "placed";

  return "transit";
}

function mapTrackingResponse(data) {
  const history = [...(data?.history || [])].sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
  );
  const timeline = history.length
    ? history.map((event, index) => ({
        key: resolveTimelineKey(event, index),
        title: event.message || event.status_code || "Shipment update",
        note: event.status_code || "Tracking update",
        location: event.location || "Shipment network",
        time: formatTimelineDate(event.event_time),
      }))
    : [
        {
          key: "placed",
          title: data?.status || "Shipment update",
          note: data?.shipment_info || "Tracking information is available for this shipment.",
          location: data?.courier_name || "Courier network",
          time: "Pending",
        },
      ];

  return {
    trackingId: data?.awb_number || "",
    orderId: data?.order_number || data?.order_id || "",
    customer: "Customer shipment",
    courier: data?.courier_name || "Courier",
    destination: "",
    eta: data?.edd || "",
    status: data?.status || "In transit",
    paymentType: data?.payment_type || "",
    timeline,
    activeStep: Math.max(timeline.length - 1, 0),
  };
}

export async function loginUser(credentials) {
  if (USE_MOCK_API) {
    return mockLogin(credentials);
  }

  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function searchTracking(trackingId) {
  if (USE_MOCK_API) {
    return mockTrackShipment(trackingId);
  }

  const response = await request(`/orders/track?awb=${encodeURIComponent(String(trackingId).trim())}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || "Tracking ID not found.");
  }

  return mapTrackingResponse(response.data);
}

export async function requestRateQuote(formValues) {
  if (USE_MOCK_API) {
    return mockCalculateRates(formValues);
  }

  const summary = buildRateSummary(formValues);

  if (!summary.valid) {
    throw new Error("Enter valid pin codes, package weight, and dimensions to calculate shipping rates.");
  }

  const response = await request("/couriers/available-to-guest", {
    method: "POST",
    body: JSON.stringify(buildRatePayload(formValues)),
  });

  if (!response.success) {
    throw new Error(response.error || response.message || "Failed to calculate rates.");
  }

  const options = mapRateOptions(response.data || [], formValues, summary);

  return {
    summary,
    options: options.length ? options : generateCourierQuotes(formValues),
  };
}

export async function submitContact(payload) {
  if (USE_MOCK_API) {
    return mockSubmitContact(payload);
  }

  return request("/contacts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
