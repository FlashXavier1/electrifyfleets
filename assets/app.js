(function () {
  'use strict';
  var cfg = window.FLEET_CONFIG;
  var calc = window.FleetCalc;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var sign = n < 0 ? '−' : '';
    var a = Math.abs(n);
    if (a >= 1e6) {
      var m = a / 1e6;
      return sign + 'J$' + (m >= 100 ? Math.round(m) : m.toFixed(m >= 10 ? 1 : 2)) + 'M';
    }
    return sign + 'J$' + (Math.round(a / 100) * 100).toLocaleString('en-US');
  }
  function whole(n) { return Math.round(n).toLocaleString('en-US'); }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  // ---------- state ----------
  function newGroup() {
    return { count: '', type: 'van', fuel: 'diesel', kmPerDay: '', seats: '', daysPerWeek: String(cfg.defaultDaysPerWeek), fuelSpendMonthly: '' };
  }
  var state = {
    depth: 'quick', step: 0, groups: [newGroup()],
    route: 'mixed', parking: 'depot', payloadKg: '', maintPerVehicle: '',
    finance: 'undecided', keepYears: '', elecRate: '', rateClass: '', solar: 'no', shifts: '1'
  };
  var STEPS = {
    quick: ['depth', 'fleet'],
    standard: ['depth', 'fleet', 'ops'],
    detailed: ['depth', 'fleet', 'ops', 'site']
  };
  function steps() { return STEPS[state.depth]; }

  // ---------- views ----------
  function show(view) {
    ['home', 'interview', 'report'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    window.scrollTo(0, 0);
  }

  // ---------- home meter ----------
  function updateMeter() {
    var km = Number($('meter-km').value);
    var van = cfg.vehicleTypes.van;
    var ev = cfg.models.filter(function (m) { return m.name === cfg.meterModel; })[0] || cfg.models[0];
    var diesel = km * van.litresPer100 / 100 * cfg.fuelPrice.diesel;
    var electric = km * ev.kwhPer100 / 100 * cfg.electricityRate;
    var max = 250 * van.litresPer100 / 100 * cfg.fuelPrice.diesel;
    var days = cfg.defaultDaysPerWeek * cfg.weeksPerYear;
    $('meter-km-out').textContent = km + ' km';
    $('bar-diesel').style.width = (diesel / max * 100) + '%';
    $('bar-electric').style.width = (electric / max * 100) + '%';
    $('cost-diesel').textContent = money(diesel);
    $('cost-electric').textContent = money(electric);
    $('meter-year').textContent = money((diesel - electric) * days);
    $('meter-basis').textContent = 'Based on diesel at J$' + cfg.fuelPrice.diesel + ' a litre, electricity at J$' +
      cfg.electricityRate + ' a kWh, a ' + ev.name + ' and ' + days + ' working days a year.';
  }

  // ---------- interview rendering ----------
  function options(map, selected, labelKey) {
    return Object.keys(map).map(function (k) {
      var label = labelKey ? map[k][labelKey] : map[k];
      return '<option value="' + esc(k) + '"' + (k === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }
  function radio(name, value, current, title, note, time) {
    return '<label><input type="radio" name="' + name + '" value="' + value + '"' + (current === value ? ' checked' : '') + '>' +
      '<span><b>' + esc(title) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</span>' +
      (time ? '<span class="time">' + esc(time) + '</span>' : '<span></span>') + '</label>';
  }
  function numberField(name, label, value, hint, attrs) {
    return '<div class="field"><label for="' + name + '">' + esc(label) +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' +
      '<input type="number" inputmode="decimal" id="' + name + '" name="' + name + '" value="' + esc(value) + '" ' + (attrs || '') + '></div>';
  }
  function selectField(name, label, html, hint) {
    return '<div class="field"><label for="' + name + '">' + esc(label) +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' +
      '<select id="' + name + '" name="' + name + '">' + html + '</select></div>';
  }

  function renderDepth() {
    return '<h1 class="step-title">How much detail do you want to give?</h1>' +
      '<p class="step-help">More detail gives a more accurate report. You can start quick and come back later.</p>' +
      '<fieldset class="fields"><legend class="fine">Choose one</legend><div class="choice">' +
      radio('depth', 'quick', state.depth, 'Quick', 'Fleet size, distance and fuel', 'About 2 minutes') +
      radio('depth', 'standard', state.depth, 'Standard', 'Adds routes, parking, maintenance and how you buy', 'About 6 minutes') +
      radio('depth', 'detailed', state.depth, 'Detailed', 'Adds separate vehicle groups, your electricity supply and solar', 'About 10 minutes') +
      '</div></fieldset>';
  }

  function renderGroup(g, i, multi) {
    var p = 'g' + i + '_';
    var head = multi
      ? '<div class="group-head"><h2>Vehicle group ' + (i + 1) + '</h2>' +
        (state.groups.length > 1 ? '<button type="button" class="btn-link" data-remove="' + i + '">Remove</button>' : '') + '</div>'
      : '';
    return '<div class="' + (multi ? 'group' : '') + '">' + head + '<div class="fields">' +
      numberField(p + 'count', 'How many vehicles would you replace or add?', g.count, 'One vehicle counts as a fleet.', 'min="1" step="1"') +
      '<div class="field-pair">' +
      selectField(p + 'type', 'Vehicle type', options(cfg.vehicleTypes, g.type, 'label')) +
      selectField(p + 'fuel', 'Fuel used today', options(cfg.fuelLabel, g.fuel)) +
      '</div>' +
      (g.type === 'passenger'
        ? selectField(p + 'seats', 'Passengers carried per vehicle', options({ '': 'Choose', 7: 'Up to 7', 15: '8 to 15' }, String(g.seats)))
        : '') +
      '<div class="field-pair">' +
      numberField(p + 'kmPerDay', 'Distance per vehicle per day (km)', g.kmPerDay, 'A typical working day.', 'min="1" step="1"') +
      selectField(p + 'daysPerWeek', 'Working days per week', options({ 5: '5 days', 6: '6 days', 7: '7 days' }, String(g.daysPerWeek))) +
      '</div>' +
      numberField(p + 'fuelSpendMonthly', 'Fuel spend per vehicle per month (J$)', g.fuelSpendMonthly, 'Optional. Leave blank and we estimate it from distance.', 'min="0" step="1000"') +
      '</div></div>';
  }

  function renderFleet() {
    var multi = state.depth === 'detailed';
    var list = multi ? state.groups : state.groups.slice(0, 1);
    return '<h1 class="step-title">Your vehicles</h1>' +
      '<p class="step-help">' + (multi
        ? 'Group vehicles that do similar work, such as town deliveries and country runs. Up to three groups.'
        : 'Describe a typical vehicle. If your vehicles do very different work, choose Detailed on the previous step.') + '</p>' +
      '<div style="margin-top:1.9rem">' + list.map(function (g, i) { return renderGroup(g, i, multi); }).join('') + '</div>' +
      (multi && state.groups.length < 3 ? '<button type="button" class="btn btn-quiet add-group" id="add-group">Add another vehicle group</button>' : '');
  }

  function renderOps() {
    return '<h1 class="step-title">How the fleet operates</h1>' +
      '<p class="step-help">Leave anything you do not know blank. We use a typical figure and say so in the report.</p>' +
      '<div class="fields">' +
      selectField('route', 'Where do the vehicles mostly drive?', options(cfg.routes, state.route, 'label')) +
      selectField('parking', 'Where do they park overnight?', options({
        depot: 'At our depot or premises', home: 'At drivers’ homes', street: 'On the street or a public lot'
      }, state.parking), 'This decides where charging can happen.') +
      numberField('payloadKg', 'Typical load carried (kg)', state.payloadKg, 'Optional. Used to confirm the right model with you.', 'min="0" step="50"') +
      numberField('maintPerVehicle', 'Maintenance per vehicle per year (J$)', state.maintPerVehicle, 'Optional. Servicing, parts and repairs.', 'min="0" step="10000"') +
      '<div class="field-pair">' +
      selectField('finance', 'How do you usually buy vehicles?', options({ undecided: 'Not sure yet', cash: 'Cash', finance: 'Loan or lease' }, state.finance)) +
      numberField('keepYears', 'Years you keep a vehicle', state.keepYears, 'Optional. We use 5 if blank.', 'min="1" max="15" step="1"') +
      '</div></div>';
  }

  function renderSite() {
    return '<h1 class="step-title">Your site and power</h1>' +
      '<p class="step-help">These help size the charging. All are optional.</p>' +
      '<div class="fields">' +
      numberField('elecRate', 'What you pay for electricity (J$ per kWh)', state.elecRate, 'Total bill divided by kWh used. We use J$' + cfg.electricityRate + ' if blank.', 'min="1" step="1"') +
      '<div class="field"><label for="rateClass">JPS rate class<span class="hint">For example Rate 20 or Rate 40, if you know it.</span></label>' +
      '<input type="text" id="rateClass" name="rateClass" maxlength="40" value="' + esc(state.rateClass) + '"></div>' +
      selectField('solar', 'Solar at your premises', options({ no: 'No solar', have: 'We have solar', interested: 'No, but interested' }, state.solar)) +
      selectField('shifts', 'Shifts per vehicle per day', options({ 1: 'One shift', 2: 'Two or more shifts' }, state.shifts), 'Vehicles on two shifts have less time to charge.') +
      '</div>';
  }

  var RENDER = { depth: renderDepth, fleet: renderFleet, ops: renderOps, site: renderSite };

  function renderStep(focus) {
    var list = steps();
    var name = list[state.step];
    $('step-body').innerHTML = RENDER[name]();
    $('progress-text').textContent = 'Step ' + (state.step + 1) + ' of ' + list.length;
    $('progress-bar').style.width = ((state.step + 1) / list.length * 100) + '%';
    $('step-next').textContent = state.step === list.length - 1 ? 'See my report' : 'Continue';
    $('step-back').textContent = state.step === 0 ? 'Cancel' : 'Back';
    $('form-error').hidden = true;
    if (focus !== false) {
      var h = $('step-body').querySelector('h1');
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    }
  }

  // Copy whatever is on screen into state.
  function collect() {
    var form = $('step-form');
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) state[el.name] = el.value; return; }
      var m = /^g(\d)_(\w+)$/.exec(el.name);
      if (m) { if (state.groups[+m[1]]) state.groups[+m[1]][m[2]] = el.value.trim(); }
      else state[el.name] = el.value.trim();
    });
  }

  function validate() {
    var name = steps()[state.step];
    var errors = [];
    Array.prototype.forEach.call($('step-form').querySelectorAll('.bad'), function (el) { el.classList.remove('bad'); });
    function bad(id, msg) { var el = $(id); if (el) el.classList.add('bad'); errors.push({ id: id, msg: msg }); }
    if (name === 'fleet') {
      var list = state.depth === 'detailed' ? state.groups : state.groups.slice(0, 1);
      list.forEach(function (g, i) {
        var where = list.length > 1 ? ' for group ' + (i + 1) : '';
        var c = Number(g.count), km = Number(g.kmPerDay);
        if (!(c >= 1) || c !== Math.floor(c) || c > 5000) bad('g' + i + '_count', 'Enter the number of vehicles' + where + ', as a whole number of 1 or more.');
        if (g.type === 'passenger' && !g.seats) bad('g' + i + '_seats', 'Choose how many passengers each vehicle carries' + where + '.');
        if (!(km >= 1) || km > 1000) bad('g' + i + '_kmPerDay', 'Enter the daily distance' + where + ' in kilometres, between 1 and 1,000.');
      });
    }
    if (name === 'ops' && state.keepYears !== '' && !(Number(state.keepYears) >= 1 && Number(state.keepYears) <= 15)) {
      bad('keepYears', 'Enter the years you keep a vehicle as a number from 1 to 15, or leave it blank.');
    }
    if (name === 'site' && state.elecRate !== '' && !(Number(state.elecRate) >= 5 && Number(state.elecRate) <= 200)) {
      bad('elecRate', 'Enter your electricity price in J$ per kWh, between 5 and 200, or leave it blank.');
    }
    var box = $('form-error');
    if (errors.length) {
      box.textContent = errors.map(function (e) { return e.msg; }).join(' ');
      box.hidden = false;
      $(errors[0].id).focus();
      return false;
    }
    box.hidden = true;
    return true;
  }

  // ---------- report ----------
  function answers() {
    var multi = state.depth === 'detailed';
    var hasOps = state.depth !== 'quick';
    return {
      depth: state.depth,
      groups: multi ? state.groups : state.groups.slice(0, 1),
      route: hasOps ? state.route : 'mixed',
      parking: hasOps ? state.parking : '',
      maintPerVehicle: hasOps ? state.maintPerVehicle : '',
      payloadKg: hasOps ? state.payloadKg : '',
      keepYears: hasOps ? state.keepYears : '',
      elecRate: multi ? state.elecRate : ''
    };
  }

  var VERDICT = {
    strong: { tag: 'Favourable' },
    look: { tag: 'Worth a closer look' },
    notyet: { tag: 'Not yet' }
  };
  var RANGE = {
    pass: 'Within range',
    marginal: 'Close to the limit',
    fail: 'Beyond one charge'
  };

  function seg(cls, value, max) {
    return value > 0 ? '<i class="' + cls + '" style="width:' + (value / max * 100) + '%"></i>' : '';
  }

  function renderReport() {
    var input = answers();
    var r = calc.assess(input, cfg);
    var t = r.totals;
    var yrs = t.years;
    var v = VERDICT[r.verdict];

    var headline;
    if (r.verdict === 'strong') headline = 'Switching ' + plural(t.vehicles, 'vehicle') + ' to electric would save about ' + money(t.annualSaving) + ' a year.';
    else if (r.verdict === 'look') headline = 'Electric could save about ' + money(t.annualSaving) + ' a year, with points to check first.';
    else headline = 'Electric does not pay for itself for this fleet yet.';

    var payback = t.paybackYears === null ? 'Not reached'
      : t.paybackYears < 0.1 ? 'From day one'
      : t.paybackYears > 20 ? 'Over 20 years'
      : t.paybackYears.toFixed(1) + ' years';

    var max = Math.max(t.dieselTotal, t.evTotal);
    var rate = Number(input.elecRate) > 0 ? Number(input.elecRate) : cfg.electricityRate;

    var rows = r.groups.map(function (g) {
      var share = Math.round(g.kmPerDay / g.model.usableRangeKm * 100);
      return '<tr><td data-label="Vehicles"><div>' + plural(g.count, 'vehicle') + '<span class="fine"> ' + esc(g.typeLabel) + ', ' + esc(g.fuelLabel.toLowerCase()) + '</span></div></td>' +
        '<td class="num" data-label="Daily distance">' + whole(g.kmPerDay) + ' km</td>' +
        '<td data-label="Suggested model"><div>' + esc(g.model.name) +
          (g.payloadOk ? '' : g.model.body === 'passenger'
            ? '<span class="fine status-fail"> Seats ' + g.model.seats + '; larger options on request</span>'
            : '<span class="fine status-fail"> Your load is above its ' + whole(g.model.payloadKg) + ' kg payload</span>') + '</div></td>' +
        '<td data-label="Range check"><div><span class="status status-' + g.range + '">' + RANGE[g.range] + '</span><span class="fine"> Uses ' + share + '% of a charge</span></div></td>' +
        '<td class="num" data-label="Saving per vehicle a year">' + money(g.perVehicle.saving) + '</td></tr>';
    }).join('');

    var parkingNote = {
      depot: 'Each vehicle comes with its own charger, installed at your premises.',
      home: 'Vehicles go home with drivers, so each charger would be installed at a driver\u2019s home.',
      street: 'With street parking, charging needs a depot arrangement or public chargers. We would plan this with you.',
      '': 'Assumes each vehicle charges overnight at your premises on its own charger.'
    }[input.parking || ''];

    var byKw = {};
    r.groups.forEach(function (g) { var k = g.model.chargerKw || 7; byKw[k] = (byKw[k] || 0) + g.count; });
    var chargerLine = Object.keys(byKw).sort(function (a, b) { return a - b; })
      .map(function (k) { return byKw[k] + ' at ' + k + ' kW'; }).join(', ');

    var f = t.finance, fc = cfg.finance;
    var financeBlock = '<div class="block"><h2>Financing example</h2>' +
      '<p>' + esc(fc.label) + ': ' + (fc.rate * 100).toFixed(2) + '% over ' + fc.years + ' years with ' +
      (fc.deposit ? Math.round(fc.deposit * 100) + '% deposit' : 'no deposit') + ', subject to approval. ' +
      'The diesel fleet is shown on the same terms for comparison.</p>' +
      '<dl class="facts" style="max-width:40rem">' +
      '<div><dt>Monthly payment, electric fleet</dt><dd>' + money(f.evPayment) + '</dd></div>' +
      '<div><dt>Monthly payment, diesel fleet</dt><dd>' + money(f.dieselPayment) + '</dd></div>' +
      '<div><dt>Extra payment for electric</dt><dd>' + money(f.extraPayment) + '</dd></div>' +
      '<div><dt>Monthly saving on fuel and maintenance</dt><dd>' + money(f.monthlySaving) + '</dd></div>' +
      '<div><dt>' + (f.net >= 0 ? 'Better off each month' : 'Net extra cost each month') + '</dt><dd><strong>' + money(Math.abs(f.net)) + '</strong></dd></div>' +
      '</dl>' +
      (f.net >= 0 ? '<p style="margin-top:1rem">On these terms the savings cover the extra payment from the first month.</p>' : '') +
      '</div>';

    var fuelsUsed = {};
    r.groups.forEach(function (g) { fuelsUsed[g.fuelLabel] = true; });
    var fuelLine = Object.keys(cfg.fuelLabel).filter(function (k) { return fuelsUsed[cfg.fuelLabel[k]]; })
      .map(function (k) { return cfg.fuelLabel[k] + ' J$' + cfg.fuelPrice[k] + ' a litre'; }).join(', ');
    var stated = r.groups.some(function (g) { return g.fuelCostSource === 'stated'; });
    var modelsUsed = {};
    r.groups.forEach(function (g) { modelsUsed[g.model.name] = g.model; });
    var placeholder = ' <span class="flag">placeholder</span>';

    var assumptions = [
      ['Fuel price', fuelLine + (stated ? ' (your own fuel spend used where given)' : '')],
      ['Electricity price', 'J$' + rate + ' a kWh' + (rate !== cfg.electricityRate ? ' (your figure)' : '')],
      ['Working year', cfg.weeksPerYear + ' weeks'],
      ['Vehicle prices', 'Flash Motors list prices, including GCT, on the road'],
      ['Diesel maintenance', Number(input.maintPerVehicle) > 0
        ? money(Number(input.maintPerVehicle)) + ' a vehicle a year (your figure)'
        : money(cfg.dieselMaintenance) + ' a year for a vehicle doing ' + whole(cfg.maintenanceReferenceKm) + ' km, scaled to your distance'],
      ['Electric maintenance', 'Scheduled servicing included for ' + cfg.serviceBundleYears + ' years. Wear and tear ' + money(cfg.evWearAndTear) +
        ' a year at the same distance' + (yrs > cfg.serviceBundleYears ? ', plus ' + money(cfg.evServiceAfterBundle) + ' a year servicing after year ' + cfg.serviceBundleYears + placeholder : '')],
      ['Period compared', plural(yrs, 'year')]
    ];
    Object.keys(modelsUsed).forEach(function (n) {
      var m = modelsUsed[n];
      assumptions.push([n, m.batteryKwh + ' kWh battery, ' + m.kwhPer100 + ' kWh per 100 km, ' + m.usableRangeKm + ' km usable range, ' +
        (m.body === 'passenger' ? m.seats + ' seats, ' : whole(m.payloadKg) + ' kg payload, ') + money(m.price) + ' against ' + money(m.dieselEquivalentPrice) + ' for a diesel equivalent' +
        (m.pending ? ' <span class="flag">to confirm: ' + esc(m.pending) + '</span>' : '')]);
    });
    assumptions.push(['Real-world allowance', 'Range set at ' + Math.round(cfg.realWorldFactor * 100) + '% of the official test figure, with energy use raised to match']);
    assumptions.push(['Chargers', 'One per vehicle, supplied and installed in the vehicle price']);
    assumptions.push(['Financing example', cfg.finance.label + ', ' + (cfg.finance.rate * 100).toFixed(2) + '% over ' + cfg.finance.years + ' years, ' +
      (cfg.finance.deposit ? Math.round(cfg.finance.deposit * 100) + '% deposit' : 'no deposit') + ', subject to approval']);

    var depthName = { quick: 'Quick', standard: 'Standard', detailed: 'Detailed' }[state.depth];
    var salesRows = [
      ['Lead rating', r.lead.label + ' (' + r.lead.score + ' of 8)'],
      ['Result', v.tag],
      ['Vehicles', String(t.vehicles)],
      ['Assessment depth', depthName],
      ['Overnight parking', input.parking || 'Not asked'],
      ['Route profile', input.route],
      ['Typical load', state.depth !== 'quick' && state.payloadKg ? state.payloadKg + ' kg' : 'Not given'],
      ['Buys with', state.depth !== 'quick' ? state.finance : 'Not asked'],
      ['JPS rate class', state.depth === 'detailed' && state.rateClass ? state.rateClass : 'Not given'],
      ['Solar', state.depth === 'detailed' ? state.solar : 'Not asked'],
      ['Shifts', state.depth === 'detailed' ? state.shifts : 'Not asked'],
      ['Vehicle value at list', money(t.evPurchase)],
      ['Models suggested', r.groups.map(function (g) { return g.count + ' \u00d7 ' + g.model.name; }).join(', ')],
      ['Monthly payment on ' + cfg.finance.label, money(t.finance.evPayment)],
      ['Chargers', String(t.chargers)]
    ];

    $('report').innerHTML =
      '<div class="report">' +
      '<div class="verdict is-' + r.verdict + '"><span class="tag">' + v.tag + '</span>' +
      '<h1>' + esc(headline) + '</h1><p>' + esc(r.reason) + '</p></div>' +

      '<dl class="figures">' +
      '<div class="figure"><dt>Saving each year</dt><dd>' + money(t.annualSaving) + '</dd></div>' +
      '<div class="figure"><dt>Pays for itself in</dt><dd>' + payback + '</dd></div>' +
      '<div class="figure"><dt>Net saving over ' + plural(yrs, 'year') + '</dt><dd>' + money(t.periodSaving) + '</dd></div>' +
      '<div class="figure"><dt>Carbon dioxide avoided each year</dt><dd>' + (t.co2Avoided / 1000).toFixed(1) + ' t</dd></div>' +
      '</dl>' +

      '<div class="block"><h2>Total cost over ' + plural(yrs, 'year') + '</h2>' +
      '<p>Buying and running ' + plural(t.vehicles, 'vehicle') + ', diesel against electric.</p>' +
      '<div class="stack">' +
      '<div class="stack-row"><b>Diesel</b><span class="stack-bar">' +
        seg('seg-buy', t.dieselPurchase, max) + seg('seg-energy', yrs * t.annualFuel, max) + seg('seg-maint', yrs * t.annualDieselMaint, max) +
      '</span><span class="stack-total">' + money(t.dieselTotal) + '</span></div>' +
      '<div class="stack-row"><b>Electric</b><span class="stack-bar">' +
        seg('seg-buy', t.evPurchase, max) + seg('seg-energy', yrs * t.annualEnergy, max) + seg('seg-maint', yrs * t.annualEvMaint, max) + seg('seg-charger', t.chargerCost, max) +
      '</span><span class="stack-total">' + money(t.evTotal) + '</span></div></div>' +
      '<ul class="legend"><li><i class="seg-buy"></i>Purchase</li><li><i class="seg-energy"></i>Fuel or electricity</li>' +
      '<li><i class="seg-maint"></i>Maintenance</li>' + (t.chargerCost > 0 ? '<li><i class="seg-charger"></i>Chargers</li>' : '') + '</ul></div>' +

      financeBlock +
      '<div class="block"><h2>Your vehicles and their routes</h2>' +
      '<div class="table-wrap"><table class="routes"><thead><tr><th>Vehicles</th><th class="num">Daily distance</th><th>Suggested model</th><th>Range check</th><th class="num">Saving per vehicle a year</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>' +

      '<div class="block two-col"><div><h2>Charging</h2><dl class="facts">' +
      '<div><dt>Chargers included with the vehicles</dt><dd>' + chargerLine + '</dd></div>' +
      '<div><dt>Longest overnight charge</dt><dd>' + t.longestCharge.toFixed(1) + ' hours</dd></div>' +
      '<div><dt>Energy used per night</dt><dd>' + whole(t.nightlyKwh) + ' kWh</dd></div>' +
      '<div><dt>Electricity cost per night</dt><dd>' + money(t.nightlyKwh * rate) + '</dd></div></dl>' +
      '<p class="fine" style="margin-top:1rem">' + esc(parkingNote) +
      (t.longestCharge > cfg.overnightHours ? ' Some vehicles need longer than ' + cfg.overnightHours + ' hours on their included charger. Faster chargers are available: ' + esc(cfg.fasterChargers) + '.' : '') + '</p></div>' +
      '<div><h2>What this report leaves out</h2><p class="fine" style="margin-top:1rem;font-size:1rem">The cost comparison is for cash purchase; loan interest appears only in the financing example. Resale value and insurance are not included. ' +
      'Range figures are estimates for loaded vehicles with air conditioning on. A site visit confirms the electrical supply and the charger count.</p></div></div>' +

      '<div class="block"><h2>Figures used</h2><dl class="facts">' +
      assumptions.map(function (a) { return '<div><dt>' + esc(a[0]) + '</dt><dd>' + a[1] + '</dd></div>'; }).join('') +
      '</dl><p class="fine" style="margin-top:1rem">Prices reviewed ' + esc(cfg.lastReviewed) + '. Fuel and electricity prices change, so treat this as an estimate.</p></div>' +

      '<div class="next"><h2>Next step</h2>' +
      '<p>' + (r.verdict === 'notyet'
        ? 'If your routes or fleet change, run the assessment again. Our team can also look at whether one or two of your busiest vehicles make sense on their own.'
        : 'Our fleet team can visit your site, confirm the charging plan and prepare a quotation based on this report.') + '</p>' +
      '<p><a href="mailto:' + cfg.contact.email + '">' + cfg.contact.email + '</a> or ' + esc(cfg.contact.phone) + '</p>' +
      '<div class="report-actions"><button type="button" class="btn btn-primary" id="print-report">Print or save as PDF</button>' +
      '<button type="button" class="btn btn-quiet" id="edit-answers">Change my answers</button>' +
      '<button type="button" class="btn-link" id="toggle-sales">Show what the sales team receives</button></div></div>' +

      '<div class="sales" id="sales-panel" hidden><h2>Sales team copy</h2><p class="fine">Prototype view. In the live tool this goes to the deal in Bigin and to ' + cfg.contact.email + '.</p>' +
      '<dl class="facts">' + salesRows.map(function (a) { return '<div><dt>' + esc(a[0]) + '</dt><dd>' + esc(a[1]) + '</dd></div>'; }).join('') +
      '</dl></div>' +
      '</div>';

    show('report');
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-go="interview"]')) { state.step = 0; show('interview'); renderStep(); return; }
    if (t.closest('.brand')) { e.preventDefault(); show('home'); return; }
    if (t.id === 'add-group') { collect(); state.groups.push(newGroup()); renderStep(false); $('g' + (state.groups.length - 1) + '_count').focus(); return; }
    if (t.dataset && t.dataset.remove) { collect(); state.groups.splice(Number(t.dataset.remove), 1); renderStep(false); return; }
    if (t.id === 'step-back') {
      collect();
      if (state.step === 0) show('home'); else { state.step--; renderStep(); }
      return;
    }
    if (t.id === 'print-report') { window.print(); return; }
    if (t.id === 'edit-answers') { state.step = 1; show('interview'); renderStep(); return; }
    if (t.id === 'toggle-sales') {
      var panel = $('sales-panel');
      panel.hidden = !panel.hidden;
      t.textContent = panel.hidden ? 'Show what the sales team receives' : 'Hide the sales team copy';
      if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' });
    }
  });

  $('step-form').addEventListener('submit', function (e) {
    e.preventDefault();
    collect();
    if (!validate()) return;
    if (state.step < steps().length - 1) { state.step++; renderStep(); }
    else renderReport();
  });

  $('step-form').addEventListener('change', function (e) {
    if (/^g\d_type$/.test(e.target.name)) { collect(); renderStep(false); $(e.target.id).focus(); }
  });

  $('meter-km').addEventListener('input', updateMeter);
  updateMeter();
})();
