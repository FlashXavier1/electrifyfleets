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

  // Smallest model that passes; failing that, the smallest marginal one;
  // failing that, the longest-range model.
  function pickModel(kmPerDay, cfg) {
    var order = ['pass', 'marginal'];
    for (var s = 0; s < order.length; s++) {
      for (var i = 0; i < cfg.models.length; i++) {
        if (rangeStatus(kmPerDay, cfg.models[i], cfg) === order[s]) return cfg.models[i];
      }
    }
    return cfg.models[cfg.models.length - 1];
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

    var model = pickModel(kmPerDay, cfg);
    var rate = num(input.elecRate, cfg.electricityRate);
    var kwh = annualKm * model.kwhPer100 / 100 * route.electric;
    var energyCost = kwh * rate;

    var dieselMaint = num(input.maintPerVehicle, cfg.dieselMaintenance);
    var evMaint = dieselMaint * cfg.evMaintenanceShare;

    var nightlyKwh = kmPerDay * model.kwhPer100 / 100 * route.electric;
    var chargeHours = nightlyKwh / cfg.chargerKw;

    return {
      count: count,
      typeLabel: type.label,
      fuelLabel: cfg.fuelLabel[fuel],
      kmPerDay: kmPerDay,
      daysPerWeek: days,
      annualKm: annualKm,
      fuelCostSource: statedFuelCost ? 'stated' : 'estimated',
      model: model,
      range: rangeStatus(kmPerDay, model, cfg),
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
      co2Avoided: 0, years: years
    };
    groups.forEach(function (g) {
      var p = g.perVehicle, n = g.count;
      t.vehicles += n;
      t.annualSaving += n * p.saving;
      t.annualFuel += n * p.fuelCost;
      t.annualEnergy += n * p.energyCost;
      t.annualDieselMaint += n * p.dieselMaint;
      t.annualEvMaint += n * p.evMaint;
      t.dieselPurchase += n * g.model.dieselEquivalentPrice;
      t.evPurchase += n * g.model.price;
      t.chargerHours += n * p.chargeHours;
      t.nightlyKwh += n * p.nightlyKwh;
      t.co2Avoided += n * (p.co2Diesel - p.co2Electric);
    });

    t.chargers = t.vehicles ? Math.max(1, Math.ceil(t.chargerHours / cfg.overnightHours)) : 0;
    // Vehicles that go home with drivers each need their own charger.
    if (input.parking === 'home') t.chargers = t.vehicles;
    t.chargerCost = t.chargers * cfg.chargerCost;
    t.premium = t.evPurchase + t.chargerCost - t.dieselPurchase;
    t.paybackYears = t.annualSaving > 0 ? Math.max(0, t.premium) / t.annualSaving : null;
    t.dieselTotal = t.dieselPurchase + years * (t.annualFuel + t.annualDieselMaint);
    t.evTotal = t.evPurchase + t.chargerCost + years * (t.annualEnergy + t.annualEvMaint);
    t.periodSaving = t.dieselTotal - t.evTotal;

    var anyFail = groups.some(function (g) { return g.range === 'fail'; });
    var anyMarginal = groups.some(function (g) { return g.range === 'marginal'; });
    var verdict, reason;
    if (t.paybackYears === null) {
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

  var api = { assess: assess, pickModel: pickModel, rangeStatus: rangeStatus };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FleetCalc = api;
})(typeof window !== 'undefined' ? window : this);
