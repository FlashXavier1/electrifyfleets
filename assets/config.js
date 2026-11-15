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
    lastReviewed: '2026-11-15',

    // Pump prices, J$ per litre.
    // Petrojam ex-refinery schedule of 12 Nov 2026 plus about J$20 retail markup.
    fuelPrice: { diesel: 262, gas87: 211, gas90: 220 },
    fuelLabel: { diesel: 'Diesel', gas87: '87 petrol', gas90: '90 petrol' },

    // All-in commercial electricity, J$ per kWh. Operators can enter their own.
    electricityRate: 40,

    // Fuel use of the vehicle being replaced, litres per 100 km. Assumed.
    vehicleTypes: {
      van:    { label: 'Panel van',   litresPer100: 10 },
      truck:  { label: 'Small truck', litresPer100: 13 },
      pickup: { label: 'Pickup',      litresPer100: 11 },
      other:  { label: 'Other',       litresPer100: 10 }
    },

    // Route profile multipliers on energy use. Assumed.
    routes: {
      city:    { label: 'Mostly city',        fuel: 1.10, electric: 0.95 },
      mixed:   { label: 'Mixed',              fuel: 1.00, electric: 1.00 },
      highway: { label: 'Highway and hills',  fuel: 1.05, electric: 1.15 }
    },

    // Electric models, smallest first. The calculator recommends the first one
    // whose range covers the daily distance.
    models: [
      {
        name: 'Farizon V7E',
        kwhPer100: 26,            // PLACEHOLDER, includes charging losses
        usableRangeKm: 160,       // PLACEHOLDER, real-world not WLTP
        price: 7500000,           // PLACEHOLDER, J$
        dieselEquivalentPrice: 6000000 // PLACEHOLDER, J$
      },
      {
        name: 'Farizon SuperVAN',
        kwhPer100: 31,            // 28.2 WLTP (83 kWh, largest body) plus 10% charging losses
        usableRangeKm: 260,       // PLACEHOLDER, about 75% of WLTP
        price: 9500000,           // PLACEHOLDER, J$
        dieselEquivalentPrice: 7500000 // PLACEHOLDER, J$
      }
    ],

    // Range check thresholds, as a share of usable range.
    rangePass: 0.8,
    rangeMarginal: 1.0,

    // Maintenance, J$ per vehicle per year.
    dieselMaintenance: 250000,    // PLACEHOLDER
    evMaintenanceShare: 0.5,      // electric cost as a share of diesel. Assumed.

    // Charging.
    chargerKw: 11,
    chargerCost: 250000,          // PLACEHOLDER, installed, J$ per unit
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

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.FLEET_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : this);
