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
    lastReviewed: '2026-11-22',

    // Pump prices, J$ per litre.
    // Petrojam ex-refinery schedule of 12 Nov 2026 plus about J$20 retail markup.
    fuelPrice: { diesel: 262, gas87: 211, gas90: 220 },
    fuelLabel: { diesel: 'Diesel', gas87: '87 petrol', gas90: '90 petrol' },

    // All-in commercial electricity, J$ per kWh. Operators can enter their own.
    electricityRate: 40,

    // Fuel use of the vehicle being replaced, litres per 100 km. Assumed.
    // "bodies" lists which electric body styles can replace it, first choice first.
    vehicleTypes: {
      van:       { label: 'Panel van',                    litresPer100: 10, bodies: ['van'] },
      passenger: { label: 'Passenger van or minibus',     litresPer100: 11, bodies: ['passenger'] },
      pickup:    { label: 'Pickup',                       litresPer100: 11, bodies: ['lighttruck', 'van'] },
      truck:     { label: 'Small truck (up to 4.3 t)',    litresPer100: 13, bodies: ['lighttruck', 'truck'] },
      bigtruck:  { label: 'Medium truck (4.5 to 6 t)',    litresPer100: 18, bodies: ['truck'] },
      other:     { label: 'Other',                        litresPer100: 10, bodies: ['van', 'lighttruck', 'truck'] }
    },

    // Route profile multipliers on energy use. Assumed.
    routes: {
      city:    { label: 'Mostly city',        fuel: 1.10, electric: 0.95 },
      mixed:   { label: 'Mixed',              fuel: 1.00, electric: 1.00 },
      highway: { label: 'Highway and hills',  fuel: 1.05, electric: 1.15 }
    },

    // Share of the official range a loaded vehicle achieves in Jamaica with air
    // conditioning on. Applied to range, and energy use is raised to match.
    realWorldFactor: 0.75,

    // Diesel comparison prices are starting prices for base manual models; the
    // Farizons are fully equipped. The report says so.
    // Electric models, smallest first. Prices are Flash Motors list prices in J$,
    // including GCT, on the road, with one charger per vehicle supplied and installed.
    // "pending" lists what is still to be confirmed; it shows in the report.
    models: [
      {
        name: 'Farizon V7E', body: 'van',            // 6.95 m3, 67 kWh CATL LFP
        batteryKwh: 66.67, wltpRangeKm: 328, wltpKwhPer100: 22.4,
        payloadKg: 1208, chargerKw: 7,
        price: 6500000,
        dieselEquivalent: 'Toyota Hiace panel van', dieselEquivalentPrice: 6500000,
        pending: ''
      },
      {
        name: 'Farizon SuperVAN', body: 'van',        // L1H1, 6.95 m3, 83 kWh CATL LFP
        batteryKwh: 82.88, wltpRangeKm: 376, wltpKwhPer100: 24.4,
        payloadKg: 1300, chargerKw: 7,
        price: 8500000,
        dieselEquivalent: 'Toyota Hiace panel van', dieselEquivalentPrice: 6500000,
        pending: ''
      },
      {
        name: 'Farizon F3E', body: 'lighttruck',      // box body, 73 kWh
        batteryKwh: 72.85, wltpRangeKm: 300, wltpKwhPer100: 24.3, // energy use derived from battery and range
        payloadKg: 2000, chargerKw: 7,
        price: 7300000,
        dieselEquivalent: 'Foton Miller box truck', dieselEquivalentPrice: 6000000,
        pending: ''
      },
      {
        name: 'Farizon H9E', body: 'truck',           // 6 t, 100 kWh, registered at 5,995 kg
        batteryKwh: 100.46, wltpRangeKm: 330, wltpKwhPer100: 30.4, // energy use derived from battery and range
        payloadKg: 2615, chargerKw: 11,
        price: 10500000,
        dieselEquivalent: '6-tonne diesel box truck', dieselEquivalentPrice: 8500000, // PLACEHOLDER
        pending: 'diesel comparison price'
      },
      {
        name: 'Farizon V7E 7-seat', body: 'passenger', seats: 7,
        batteryKwh: 66.67, wltpRangeKm: 328, wltpKwhPer100: 22.4, // assumed same as cargo V7E
        payloadKg: 0, chargerKw: 7,
        price: 7500000,                               // cargo price plus J$1.0M
        noComparison: true,                           // no direct diesel equivalent
        dieselEquivalent: '', dieselEquivalentPrice: 7500000,
        pending: 'passenger range'
      },
      {
        name: 'Farizon SuperVAN 15-seat', body: 'passenger', seats: 15,
        batteryKwh: 82.88, wltpRangeKm: 376, wltpKwhPer100: 24.4, // assumed same as cargo SuperVAN
        payloadKg: 0, chargerKw: 7,
        price: 11000000,                              // cargo price plus J$2.5M
        dieselEquivalent: 'Toyota Hiace Commuter', dieselEquivalentPrice: 8000000,
        pending: 'passenger range'
      }
    ],
    meterModel: 'Farizon SuperVAN',

    // Range check thresholds, as a share of usable range.
    rangePass: 0.8,
    rangeMarginal: 1.0,

    // Maintenance, J$ per vehicle per year.
    // Consumables (tyres, brake pads, wipers) cost about the same for diesel
    // and electric, so they are left out of both sides.
    dieselMaintenanceAll: 500000,   // all-in, as given by Flash Motors
    consumables: 75000,             // per vehicle per year, same for both
    // The maintenance figures above are for a vehicle doing this many km a year.
    // Vehicles doing more or less are scaled in proportion, within these limits.
    maintenanceReferenceKm: 30000,   // Assumed: 100 km a day, 300 days
    maintenanceScaleMin: 0.3,
    maintenanceScaleMax: 2,
    // Electric: scheduled servicing is bundled for the first 5 years; wear and
    // tear (tyres, brake pads, wipers, repairs) is not.
    serviceBundleYears: 5,
    evServiceAfterBundle: 100000, // servicing cost per year after the bundle ends

    // Charging. Each vehicle comes with its own charger (chargerKw on the model),
    // supplied and installed in the vehicle price.
    chargerIncluded: true,
    chargerCost: 0,
    fasterChargers: '22 kW AC or DC from 25 kW, quoted by our team',
    overnightHours: 10,

    // Financing example shown in the report.
    finance: { label: 'JN special rate', rate: 0.0799, years: 10, deposit: 0 },

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

  // Diesel servicing and repairs, consumables excluded.
  CONFIG.dieselMaintenance = CONFIG.dieselMaintenanceAll - CONFIG.consumables;

  // Real-world figures derived from the spec values above.
  CONFIG.models.forEach(function (m) {
    m.usableRangeKm = Math.round(m.wltpRangeKm * CONFIG.realWorldFactor);
    m.kwhPer100 = Math.round(m.wltpKwhPer100 / CONFIG.realWorldFactor * 10) / 10;
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.FLEET_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : this);
