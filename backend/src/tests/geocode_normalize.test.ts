import assert from "node:assert/strict";
import { test } from "node:test";
import {
  censusMatchPlausible,
  streetCandidatesForCensus,
} from "../geocode/census.js";

test("streetCandidatesForCensus cleans assessor quirks Census rejects", () => {
  const sf = streetCandidatesForCensus("397 05TH AV");
  assert.equal(sf[0], "397 5TH AVE");

  const dual = streetCandidatesForCensus("600 JACKSON/601 HARRISON");
  assert.ok(dual.includes("600 JACKSON"));

  const frac = streetCandidatesForCensus("322-322.5 Western Ave");
  assert.equal(frac[0], "322 Western Ave");

  const newark = streetCandidatesForCensus("521-523 S 17TH");
  assert.ok(newark.some((s) => /521.*S 17TH ST/i.test(s)));
});

test("censusMatchPlausible rejects wrong house-number snaps", () => {
  assert.equal(
    censusMatchPlausible("322-322.5 Western Ave", "5 WESTERN AVE, CAMBRIDGE, MA, 02163"),
    false,
  );
  assert.equal(
    censusMatchPlausible("322 Western Ave", "322 WESTERN AVE, CAMBRIDGE, MA, 02139"),
    true,
  );
  assert.equal(censusMatchPlausible("WILLOWWOOD ST", "10 WILLOWWOOD ST, BOSTON, MA"), true);
});
