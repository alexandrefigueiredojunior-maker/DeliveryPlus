type DeliveryCoordinates = { lat: number; lng: number };

let googleMapsLoader: Promise<any | null> | null = null;
const pendingAddressLookups = new Map<string, Promise<DeliveryCoordinates | null>>();

async function loadGoogleMapsForGeocoding(): Promise<any | null> {
  if (typeof window === "undefined") return null;

  const win = window as any;
  if (win.google?.maps?.Geocoder) return win.google.maps;
  if (googleMapsLoader) return googleMapsLoader;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("[DeliveryPlus] VITE_GOOGLE_MAPS_API_KEY não configurada; geocodificação ignorada.");
    return null;
  }

  googleMapsLoader = new Promise((resolve) => {
    const finish = () => {
      const maps = (window as any).google?.maps;
      resolve(maps?.Geocoder ? maps : null);
    };

    const existingScript = document.getElementById("google-maps-modern-script") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => resolve(null), { once: true });
      if ((window as any).google?.maps?.Geocoder) finish();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-modern-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      console.error("[DeliveryPlus] Não foi possível carregar o Google Maps para localizar o endereço.");
      resolve(null);
    }, { once: true });
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

/**
 * Localiza um endereço de entrega usando a chave Google Maps já usada pelo DeliveryPlus.
 * Prioriza resultados de endereço completo; aceita rua apenas quando o Google não marcou
 * o resultado como correspondência parcial. Não usa centro de cidade como fallback.
 */
export async function geocodeDeliveryAddress(address: string): Promise<DeliveryCoordinates | null> {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) return null;

  const cacheKey = normalizedAddress.toLocaleLowerCase("pt-BR");
  const pending = pendingAddressLookups.get(cacheKey);
  if (pending) return pending;

  const lookup = (async (): Promise<DeliveryCoordinates | null> => {
    const maps = await loadGoogleMapsForGeocoding();
    if (!maps?.Geocoder) return null;

    return new Promise((resolve) => {
      try {
        const geocoder = new maps.Geocoder();
        geocoder.geocode(
          { address: normalizedAddress, region: "BR" },
          (results: any[], status: string) => {
            if (status !== "OK" || !Array.isArray(results) || results.length === 0) {
              console.warn("[DeliveryPlus] Google Geocoder não encontrou o endereço:", status);
              resolve(null);
              return;
            }

            const exactResult = results.find((result) =>
              ["street_address", "premise", "subpremise"].some((type) => result.types?.includes(type))
            );
            const streetResult = results.find((result) =>
              result.types?.includes("route") && result.partial_match !== true
            );
            const bestResult = exactResult || streetResult;
            const location = bestResult?.geometry?.location;

            if (!location) {
              resolve(null);
              return;
            }

            const lat = typeof location.lat === "function" ? location.lat() : Number(location.lat);
            const lng = typeof location.lng === "function" ? location.lng() : Number(location.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
              resolve(null);
              return;
            }

            resolve({ lat, lng });
          }
        );
      } catch (error) {
        console.warn("[DeliveryPlus] Erro ao geocodificar endereço:", error);
        resolve(null);
      }
    });
  })();

  pendingAddressLookups.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    pendingAddressLookups.delete(cacheKey);
  }
}
