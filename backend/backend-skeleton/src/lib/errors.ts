export class NoStopNearbyError extends Error {
  constructor(
    readonly which: "origin" | "destination",
    readonly coordinate: { lat: number; lng: number }
  ) {
    super(
      `Titik ${which} (${coordinate.lat}, ${coordinate.lng}) tidak terjangkau ` +
        `oleh mesin routing OTP2 — kemungkinan di luar area cakupan graf ` +
        `(OSM + GTFS TransJakarta).`
    );
    this.name = "NoStopNearbyError";
  }
}
