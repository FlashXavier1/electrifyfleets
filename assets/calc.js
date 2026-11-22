/*
 * Fleet assessment calculation. Pure functions: answers in, results out.
 * Runs in the browser and in Node (for tests and, later, the server).
 */
(function (root) {
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  function rangeStatus(kmPerDay, model, cfg) {
    var share = kmPerDay / model.usableRangeKm;
    if (share <= cfg.rangePass) return 'pass';
    if (share <= cfg.rangeMarginal) return 'marginal';
    return 'fail';
  }

  // Models that can replace this vehicle type, in order of preference.
  function candidates(typeKey, cfg) {
    var type = cfg.vehicleTypes[typeKey] || cfg.vehicleTypes.van;
    var list = [];
    type.bodies.forEach(function (body) {
      cfg.models.forEach(function (m) { if (m.body === body) list.push(m); });
    });
    return list.length ? list : cfg.models.slice();
  }

  // Among models that carry the load: the first that passes the range check;
  // failing that, the first marginal one; failing that, the longest-range one.
  function pickModel(kmPerDay, payloadKg, typeKey, cfg, seats) {
    var all = candidates(typeKey, cfg);
    var fits = all.filter(function (m) {
      if (m.body === 'passenger') return !(seats > 0) || (m.seats || 0) >= seats;
      return !(payloadKg > 0) || m.payloadKg >= payloadKg;
    });
    var pool = fits.length ? fits : all;
    var order = ['pass', 'marginal'];
    for (var s = 0; s < order.length; s++) {
      for (var i = 0; i < pool.length; i++) {
        if (rangeStatus(kmPerDay, pool[i], cfg) === order[s]) return pool[i];
      }
    }
    return pool.reduce(function (best, m) { return m.usableRangeKm > best.usableRangeKm ? m : best; });
  }

  function assessGroup(g, input, cfg) {
    var count = Math.round(num(g.count, 1));
    var type = cfg.vehicleTypes[g.type] || cfg.vehicleTypes.van;
    var fuel = cfg.fuelPrice[g.fuel] ? g.fuel : 'diesel';
    var route = cfg.routes[input.route] || cfg.routes.mixed;
    var kmPerDay = num(g.kmPerDay, 0);
    var days = num(g.daysPerWeek, cfg.defaultDaysPerWeek);
    var annualKm = kmPerDay * days * cfg.weeksPerYear;

    var litres = annualKm * type.litresPer100 / 100 * route.fuel;
    var estimatedFuelCost = litres * cfg.fuelPrice[fuel];
    var statedFuelCost = num(g.fuelSpendMonthly, 0) * 12;
    var fuelCost = statedFuelCost || estimatedFuelCost;
    // If the operator gave their own spend, back out litres from it for CO2.
    if (statedFuelCost) litres = statedFuelCost / cfg.fuelPrice[fuel];

    var payload = num(input.payloadKg, 0);
    var seats = num(g.seats, 0);
    // Hills and highways use more energy, so the range check uses the
    // route-adjusted distance.
    var effectiveKm = kmPerDay * route.electric;
    var suggested = pickModel(effectiveKm, payload, g.type, cfg, seats);
    var chosen = null;
    if (g.model) cfg.models.forEach(function (m) { if (m.name === g.model) chosen = m; });
    var model = chosen || suggested;
    var rate = num(input.elecRate, cfg.electricityRate);
    var kwh = annualKm * model.kwhPer100 / 100 * route.electric;
    var energyCost = kwh * rate;

    // Maintenance scales with distance unless the operator gave their own figure.
    var ownMaint = num(input.maintPerVehicle, 0);
    var scale = ownMaint ? 1 : Math.min(cfg.maintenanceScaleMax,
      Math.max(cfg.maintenanceScaleMin, annualKm / cfg.maintenanceReferenceKm));
    var dieselMaint = ownMaint || cfg.dieselMaintenance * scale;
    // Average over the period: wear and tear every year, plus servicing for any
    // years beyond the bundled service package.
    var years = num(input.keepYears, cfg.defaultYears);
    var unbundled = Math.max(0, years - cfg.serviceBundleYears);
    var evScale = ownMaint ? ownMaint / cfg.dieselMaintenance : scale;
    var evMaint = cfg.evServiceAfterBundle * unbundled / years * evScale;

    var nightlyKwh = kmPerDay * model.kwhPer100 / 100 * route.electric;
    var chargeHours = nightlyKwh / (model.chargerKw || 7);

    return {
      count: count,
      typeLabel: type.label,
      fuelLabel: cfg.fuelLabel[fuel],
      kmPerDay: kmPerDay,
      daysPerWeek: days,
      annualKm: annualKm,
      fuelCostSource: statedFuelCost ? 'stated' : 'estimated',
      model: model,
      range: rangeStatus(effectiveKm, model, cfg),
      chargeShare: effectiveKm / model.usableRangeKm,
      chosenByCustomer: !!chosen,
      suggested: suggested,
      payloadOk: model.body === 'passenger' ? !(seats > (model.seats || 0)) : !(payload > model.payloadKg),
      seats: seats,
      chargeOk: chargeHours <= cfg.overnightHours,
      perVehicle: {
        fuelCost: fuelCost,
        energyCost: energyCost,
        dieselMaint: dieselMaint,
        evMaint: evMaint,
        saving: fuelCost + dieselMaint - energyCost - evMaint,
        nightlyKwh: nightlyKwh,
        chargeHours: chargeHours,
        co2Diesel: litres * cfg.co2PerLitre[fuel],
        co2Electric: kwh * cfg.gridCo2PerKwh
      }
    };
  }

  function assess(input, cfg) {
    var years = num(input.keepYears, cfg.defaultYears);
    var groups = (input.groups || []).map(function (g) { return assessGroup(g, input, cfg); });

    var t = {
      vehicles: 0, annualSaving: 0, annualFuel: 0, annualEnergy: 0,
      annualDieselMaint: 0, annualEvMaint: 0,
      dieselPurchase: 0, evPurchase: 0, chargerHours: 0, nightlyKwh: 0,
      co2Avoided: 0, uncompared: 0, years: years
    };
    groups.forEach(function (g) {
      var p = g.perVehicle, n = g.count;
      t.vehicles += n;
      t.annualSaving += n * p.saving;
      t.annualFuel += n * p.fuelCost;
      t.annualEnergy += n * p.energyCost;
      t.annualDieselMaint += n * p.dieselMaint;
      t.annualEvMaint += n * p.evMaint;
      t.dieselPurchase += n * (g.model.noComparison ? g.model.price : g.model.dieselEquivalentPrice);
      if (g.model.noComparison) t.uncompared += n;
      t.evPurchase += n * g.model.price;
      t.chargerHours += n * p.chargeHours;
      t.nightlyKwh += n * p.nightlyKwh;
      t.co2Avoided += n * (p.co2Diesel - p.co2Electric);
    });

    t.chargers = t.vehicles ? Math.max(1, Math.ceil(t.chargerHours / cfg.overnightHours)) : 0;
    if (cfg.chargerIncluded) t.chargers = t.vehicles;
    // Vehicles that go home with drivers each need their own charger.
    if (input.parking === 'home') t.chargers = t.vehicles;
    t.chargerCost = t.chargers * cfg.chargerCost;
    t.premium = t.evPurchase + t.chargerCost - t.dieselPurchase;
    t.paybackYears = t.annualSaving > 0 ? Math.max(0, t.premium) / t.annualSaving : null;
    t.dieselTotal = t.dieselPurchase + years * (t.annualFuel + t.annualDieselMaint);
    t.evTotal = t.evPurchase + t.chargerCost + years * (t.annualEnergy + t.annualEvMaint);
    t.periodSaving = t.dieselTotal - t.evTotal;

    // Financing example: the electric fleet against a diesel fleet on the same terms.
    var f = cfg.finance;
    function monthly(principal) {
      var r = f.rate / 12, n = f.years * 12;
      return principal <= 0 ? 0 : r ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
    }
    t.finance = {
      evPayment: monthly(t.evPurchase * (1 - f.deposit)),
      dieselPayment: monthly(t.dieselPurchase * (1 - f.deposit)),
      monthlySaving: t.annualSaving / 12
    };
    t.finance.extraPayment = t.finance.evPayment - t.finance.dieselPayment;
    t.finance.net = t.finance.monthlySaving - t.finance.extraPayment;

    t.longestCharge = groups.reduce(function (h, g) { return Math.max(h, g.perVehicle.chargeHours); }, 0);
    var anyFail = groups.some(function (g) { return g.range === 'fail'; });
    var anyMarginal = groups.some(function (g) { return g.range === 'marginal'; });
    t.allUncompared = t.vehicles > 0 && t.uncompared === t.vehicles;
    var verdict, reason;
    if (t.allUncompared && t.annualSaving > 0) {
      verdict = 'look';
      reason = 'Running costs are lower on electricity. There is no direct diesel equivalent to compare the purchase price with, so our team will price that with you.';
    } else if (t.paybackYears === null) {
      verdict = 'notyet';
      reason = 'At this mileage, running costs would not be lower on electricity.';
    } else if (anyFail) {
      verdict = 'look';
      reason = 'Some daily routes are longer than one charge covers, so those vehicles would need a midday top-up or a different plan.';
    } else if (t.paybackYears <= years && !anyMarginal) {
      verdict = 'strong';
      reason = 'The savings repay the higher purchase price within the time you keep your vehicles.';
    } else if (t.paybackYears <= years * 1.5) {
      verdict = 'look';
      reason = anyMarginal
        ? 'The costs work, but some daily routes use nearly a full charge.'
        : 'The savings are real, but repaying the purchase price takes longer than you usually keep vehicles.';
    } else {
      verdict = 'notyet';
      reason = 'Your vehicles do not travel far enough each day for fuel savings to repay the purchase price in reasonable time.';
    }

    var score = (t.vehicles >= 21 ? 4 : t.vehicles >= 6 ? 3 : t.vehicles >= 2 ? 2 : 1)
      + (verdict === 'strong' ? 3 : verdict === 'look' ? 2 : 1)
      + (input.parking === 'depot' ? 1 : 0);

    return {
      groups: groups, totals: t, verdict: verdict, reason: reason,
      lead: { score: score, label: score >= 7 ? 'Hot' : score >= 5 ? 'Warm' : 'Cool' }
    };
  }

  var api = { assess: assess, pickModel: pickModel, rangeStatus: rangeStatus, candidates: candidates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FleetCalc = api;
})(typeof window !== 'undefined' ? window : this);
