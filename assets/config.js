/*
 * Fleet assessment settings.
 * Every number the calculator uses lives here. Edit this file to update prices
 * and assumptions; no other file needs to change.
 *
 * Entries marked PLACEHOLDER are stand-ins, not real Flash Motors figures.
 * They must be replaced before the tool goes public.
 */
(function (root) {
  var CONFIG = {
    lastReviewed: '2026-11-17',

    // Pump prices, J$ per litre.
    // Petrojam ex-refinery schedule of 12 Nov 2026 plus about J$20 retail markup.
    fuelPrice: { diesel: 262, gas87: 211, gas90: 220 },
    fuelLabel: { diesel: 'Diesel', gas87: '87 petrol', gas90: '90 petrol' },

    // All-in commercial electricity, J$ per kWh. Operators can enter their own.
    electricityRate: 40,

    // Fuel use of the vehicle being replaced, litres per 100 km. Assumed.
    // "bodies" lists which electric body styles can replace it, first choice first.
    vehicleTypes: {
      van:      { label: 'Panel van',                    litresPer100: 10, bodies: ['van'] },
      pickup:   { label: 'Pickup',                       litresPer100: 11, bodies: ['lighttruck', 'van'] },
      truck:    { label: 'Small truck (up to 3.5 t)',    litresPer100: 13, bodies: ['lighttruck', 'truck'] },
      bigtruck: { label: 'Medium truck (4.5 to 6 t)',    litresPer100: 18, bodies: ['truck'] },
      other:    { label: 'Other',                        litresPer100: 10, bodies: ['van', 'lighttruck', 'truck'] }
    },

    // Route profile multipliers on energy use. Assumed.
    routes: {
      city:    { label: 'Mostly city',        fuel: 1.10, electric: 0.95 },
      mixed:   { label: 'Mixed',              fuel: 1.00, electric: 1.00 },
      highway: { label: 'Highway and hills',  fuel: 1.05, electric: 1.15 }
    },

    // Share of the official (WLTP) range a loaded vehicle achieves in Jamaican
    // conditions. Applied to both range and energy use. Assumed until real-world
    // test results are available.
    realWorldFactor: 0.8,

    // Electric models, smallest first. Prices are Flash Motors list prices (J$)
    // and include one 7 kW charger per vehicle.
    // wltpRangeKm and wltpKwhPer100 come from the Farizon spec sheets where the
    // sheet gives them. "pending" lists what is still to be confirmed.
    models: [
      {
        name: 'Farizon V7E', body: 'van',
        batteryKwh: 66.67, wltpRangeKm: 328, wltpKwhPer100: 22.4,
        payloadKg: 1208,                 // GVW 3150 less kerb weight 1942
        price: 6500000,
        dieselEquivalentPrice: 5500000,  // PLACEHOLDER
        pending: 'battery size (50 or 67 kWh), diesel comparison price'
      },
      {
        name: 'Farizon SuperVAN', body: 'van',  // L1H1, 6.95 cubic metres
        batteryKwh: 82.88, wltpRangeKm: 376, wltpKwhPer100: 24.4,
        payloadKg: 1300,
        price: 8500000,
        dieselEquivalentPrice: 7000000,  // PLACEHOLDER
        pending: 'battery size (49, 66, 67 or 83 kWh), diesel comparison price'
      },
      {
        name: 'Farizon F3E', body: 'lighttruck',
        batteryKwh: 72.85, wltpRangeKm: 240, wltpKwhPer100: 30,  // PLACEHOLDER, not on the spec sheet
        payloadKg: 1500,                 // PLACEHOLDER, not on the spec sheet
        price: 7300000,
        dieselEquivalentPrice: 6000000,  // PLACEHOLDER
        pending: 'range, energy use, payload, diesel comparison price'
      },
      {
        name: 'Farizon H9E', body: 'truck',     // 6 t, 100.46 kWh
        batteryKwh: 100.46, wltpRangeKm: 250, wltpKwhPer100: 40, // PLACEHOLDER, not on the spec sheet
        payloadKg: 2615,                 // 5995 kg GVW less 3380 kg kerb weight with cargo box
        price: 10500000,
        dieselEquivalentPrice: 8500000,  // PLACEHOLDER
        pending: 'range, energy use, diesel comparison price'
      }
    ],
    meterModel: 'Farizon SuperVAN',

    // Range check thresholds, as a share of usable range.
    rangePass: 0.8,
    rangeMarginal: 1.0,

    // Maintenance, J$ per vehicle per year.
    dieselMaintenance: 250000,    // PLACEHOLDER
    evMaintenanceShare: 0.5,      // electric cost as a share of diesel. Assumed.

    // Charging. One charger per vehicle is included in the vehicle price.
    chargerKw: 7,
    chargerIncluded: true,
    chargerCost: 0,               // extra cost per charger on top of the vehicle price
    overnightHours: 10,

    // Working pattern.
    weeksPerYear: 50,
    defaultDaysPerWeek: 6,
    defaultYears: 5,

    // Emissions, kg CO2.
    co2PerLitre: { diesel: 2.68, gas87: 2.31, gas90: 2.31 },
    gridCo2PerKwh: 0.65,          // Assumed for the JPS grid

    contact: {
      email: 'sales@flash-motors.com',
      phone: '+1 (876) 676-5364',
      address: '5-7 Orchard Rd, Kingston 5, Jamaica'
    }
  };

  // Real-world figures derived from the spec values above.
  CONFIG.models.forEach(function (m) {
    m.usableRangeKm = Math.round(m.wltpRangeKm * CONFIG.realWorldFactor);
    m.kwhPer100 = Math.round(m.wltpKwhPer100 / CONFIG.realWorldFactor * 10) / 10;
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.FLEET_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : this);
