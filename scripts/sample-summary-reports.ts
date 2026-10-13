/**
 * Adds preview summary reports to the seeded demo claims.
 * Non-destructive: only creates a report where a claim has none, and only fills
 * blank Report Details fields on the claim. Run with:
 *   npx tsx scripts/sample-summary-reports.ts
 * Add --refresh to overwrite the existing reports on these demo claims with the
 * sample text below.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveSummaryReport, type SummaryReportInput } from "@/lib/reports/summary-report-server";

const SAMPLES: Record<string, SummaryReportInput> = {
  "BL-26-0002": {
    status: "DRAFT",
    header: {
      reportDate: "8/14/2026",
      dateInspected: "8/12/2026",
      taskCompleted: "8/14/2026",
      formType: "CIT HO-3 07 23",
      policyType:
        "Coverage applies to risks of direct physical loss to the dwelling and other structures, subject to policy exclusions; personal property is covered for named perils.",
      effectiveDate: "1/15/2026",
    },
    sections: {
      assignmentNotes: [
        "Initial contact was made with the insureds, James and Patricia Whitaker, on 8/6/2026.",
        "The inspection took place on 8/12/2026.",
        "The carrier's assigned field adjuster is Tom Bradley, and the desk adjuster (claims examiner) is Renee Caldwell.",
        "A certified copy of the policy was requested from the carrier on 8/7/2026.",
      ].join("\n"),
      riskOccupancy:
        "The insured property is a two-story, single-family residence located at 902 Ocean Blvd, Fort Lauderdale, FL 33316. The structure is of masonry first-floor and wood-frame second-floor construction with a hip roof covered in dimensional asphalt shingles, aluminum soffit and fascia, and impact-rated windows on the ground floor. The home is owner-occupied by the named insureds as their primary residence. A detached two-car garage and a wood privacy fence are located at the rear of the lot.",
      inspection:
        "The risk was inspected on August 12, 2026, with the Public Adjuster and both named insureds present. The claim involves a reported hurricane windstorm on June 21, 2026, resulting in the removal of roof covering and subsequent interior water intrusion. All accessible exterior elevations, the roof surface, the attic space, and the interior rooms were documented and photographed. Missing and creased shingles were observed across the south and west slopes, with exposed underlayment in two areas and lifted ridge cap along the main ridge. Within the attic, water staining was observed on the roof decking, and the batt insulation was wet and compressed above the primary bedroom. Interior damages were concentrated on the second floor, including the primary bedroom, the hallway, and the guest bathroom. A tarp had been installed by the insureds' roofer on June 23, 2026, and remained in place at the time of inspection. Moisture readings were taken in the affected rooms, and elevated readings were recorded in the primary bedroom ceiling and the hallway wall.",
      causeOfLoss:
        "Based on the conditions observed during the inspection, the damages are consistent with wind uplift forces acting on the roof covering during the June 21, 2026 hurricane event. The directional pattern of missing and creased shingles on the windward south and west slopes, the lifted ridge cap, and the absence of comparable damage on the protected slopes support a wind-created opening. Interior water damage on the second floor is consistent with rainwater entering through the wind-created openings and is claimed as an ensuing loss under Coverage A. The carrier has retained Dr. Alan Pierce of Gulf Coast Engineering; the Public Adjuster will review the engineering report upon receipt.",
      causeOfLossStatement:
        "Windstorm (hurricane) — wind uplift damage to the roof covering with ensuing rainwater intrusion.",
      originOfLoss: "South and west roof slopes above the primary bedroom and second-floor hallway.",
      recommendations:
        "Inspection findings support a covered windstorm loss to the roof system with ensuing interior water damage on the second floor. Given the extent of creased and missing shingles across two slopes and Florida's matching requirements, a full roof replacement is recommended rather than spot repairs. The Roof Surfacing Payment Schedule endorsement is on the policy and must be reviewed to confirm whether the roof covering will be paid on an ACV or RCV basis; the carrier's position will be requested in writing. An Xactimate estimate is being prepared for the roof replacement, interior repairs, and the detached garage and fence under Coverage B. The insureds should obtain a mitigation invoice and drying logs for the second floor, and moisture mapping should be completed before drywall is closed. The hurricane deductible (2% of Coverage A, $8,400.00) should be verified against the declarations page.",
      riskAlert:
        "Wet, sagging ceiling drywall was observed in the primary bedroom. The insureds were advised to keep the room closed off until the ceiling is removed. No other safety concerns were observed.",
      damages: [
        "ROOF: Missing and creased dimensional shingles on the south and west slopes (approximately 14 squares affected), exposed underlayment in two areas, and lifted ridge cap along the main ridge. A temporary tarp is in place over the south slope.",
        "ATTIC: Water staining on the roof decking above the primary bedroom and wet, compressed batt insulation over approximately 180 SF.",
        "PRIMARY BEDROOM: Ceiling drywall stained and sagging over approximately 60 SF with elevated moisture readings. Crown molding separated at the exterior wall, and the carpet is stained beneath the affected ceiling area.",
        "HALLWAY (2ND FLOOR): Ceiling staining and paint blistering along the exterior wall, with elevated moisture readings at the base of the wall.",
        "GUEST BATHROOM: Ceiling staining around the exhaust fan housing; the fan has reportedly been inoperable since the storm.",
        "DETACHED GARAGE: Displaced shingles along the rake edge and a bent gutter section on the west side (Coverage B).",
        "FENCE: Two 8-foot sections of wood privacy fence blown down on the north property line (Coverage B).",
      ].join("\n"),
      nonRelatedDamage:
        "Minor granule loss and age-related curling were observed on the north slope, which was not exposed to the prevailing wind direction; these conditions are consistent with normal wear and are not included in the claim. Hairline settlement cracking at the garage threshold is pre-existing and unrelated.",
      priorLosses:
        "The insureds reported a prior water claim in 2019 for a supply line leak in the first-floor kitchen, which was repaired. The prior loss is in an area not affected by this claim, and the repair invoices have been requested from the insureds.",
      mold:
        "No visible microbial growth was observed at the time of inspection. Given the elevated moisture readings in the primary bedroom ceiling more than seven weeks after the date of loss, testing is recommended prior to repairs. The policy carries the HO 04 94 Limited Fungi endorsement, and any remediation costs will be subject to that sublimit.",
      contents:
        "The insureds reported damage to a mattress, bedding, an upholstered bench, and clothing in the primary bedroom closet. Items were photographed during the inspection. The insureds were provided a contents inventory form and asked to list each item with its age, quantity, and replacement cost. The Coverage C limit is $210,000.00.",
      ems:
        "Temporary repairs: Coastal Roofing & Restoration, selected and contracted by the insureds, installed a temporary tarp on June 23, 2026; the tarp invoice has been requested. Mitigation: no mitigation company had been retained for the second floor at the time of inspection, and the carrier has not offered a mitigation vendor. On the Public Adjuster's recommendation, the insureds contracted Dry Pro Restoration on August 13, 2026 to dry the affected rooms. The signed work authorization, mitigation invoice, moisture logs, and photographs will be submitted to the carrier.",
      ale:
        "The home remains habitable; the insureds are using the first-floor rooms while the primary bedroom is closed off. Additional Living Expense may be required during roof replacement and second-floor repairs and will be reassessed once the repair schedule is known. The Coverage D limit is $84,000.00.",
      subrogation:
        "There does not appear to be any subrogation potential for this claim; the damages arise from a natural catastrophe and no third-party involvement was identified.",
    },
  },
  "BL-26-0003": {
    status: "DRAFT",
    header: {
      reportDate: "8/11/2026",
      dateInspected: "8/10/2026",
      taskCompleted: "8/11/2026",
      formType: "FP-7955 Homeowners Policy",
      policyType:
        "Coverage applies to accidental direct physical loss to the dwelling, subject to policy exclusions and conditions.",
      effectiveDate: "3/1/2026",
    },
    sections: {
      assignmentNotes: [
        "Initial contact was made with the insured, Robert Nguyen, on 8/6/2026.",
        "The inspection took place on 8/10/2026.",
        "The carrier's assigned field adjuster is Lisa Nguyen, and the desk adjuster (claims examiner) is Kevin Ortiz.",
        "A certified copy of the policy was requested from the carrier on 8/11/2026; coverage limits will be added upon receipt.",
      ].join("\n"),
      riskOccupancy:
        "The insured property is a one-story, single-family residence located at 4412 Palm Harbor Dr, Tampa, FL 33615. The structure is of concrete block construction with a stucco finish and a gable roof covered in three-tab asphalt shingles installed in 2014 per the insured. The home has aluminum gutters and soffit, a screened lanai, and a ground-mounted HVAC condenser on the east side. The home is owner-occupied as the insured's primary residence.",
      inspection:
        "The risk was inspected on August 10, 2026, with the Public Adjuster and Insured present. The claim involves a reported hail event on June 6, 2026. All four roof slopes, the exterior elevations, soft metals, and the screened lanai were inspected and photographed, and 10' x 10' test squares were marked on each slope. Hail impacts were identified on every slope, with the highest concentration on the west and north slopes. Soft-metal indicators, including the HVAC condenser fins, gutters, downspouts, and roof vents, displayed consistent circular denting. The interior was walked, and no ceiling staining or active leaks were observed at the time of inspection.",
      causeOfLoss:
        "Based on the conditions observed during the inspection, the damages are consistent with hail impact. The test squares documented functional bruising with granule displacement and fractured mat on each slope, and the size and spacing of soft-metal dents correspond to the hail sizes reported in NOAA storm data for the date of loss. The carrier has scheduled an engineering inspection with Midwest Hail Labs; the Public Adjuster will attend and request a copy of the report.",
      causeOfLossStatement: "Hail — functional impact damage to the roof covering and soft metals.",
      originOfLoss: "All roof slopes, heaviest on the west and north elevations, and the east-side HVAC condenser.",
      recommendations:
        "Inspection findings support a covered hail loss to the roof covering, soft metals, and HVAC condenser. Test-square counts exceed the threshold for functional damage on all slopes, and the three-tab shingle is discontinued; a full roof replacement is recommended. An HVAC contractor should evaluate the condenser coil, as the fin damage extends across more than half of the coil face. The screen enclosure panels should be re-inspected with the carrier's engineer. An Xactimate estimate is in progress and will be submitted after the engineering inspection. The certified policy has been requested to confirm the roof deductible and whether a cosmetic-damage exclusion endorsement applies.",
      riskAlert: "No risk concerns observed at the time of inspection.",
      damages: [
        "ROOF: Hail bruising with granule loss and fractured mat on all slopes. Test squares: west 14 hits, north 12, south 9, east 8.",
        "GUTTERS & DOWNSPOUTS: Circular denting along the west and north gutter runs and on three downspouts.",
        "ROOF VENTS: Dented turtle vents and a dented plumbing vent boot on the west slope.",
        "HVAC CONDENSER: Flattened fins across approximately 60% of the coil face on the north and west sides of the unit.",
        "SCREEN ENCLOSURE: Two torn screen panels on the west side of the lanai.",
      ].join("\n"),
      nonRelatedDamage:
        "Algae staining on the north slope and minor stucco cracking at the window corners were observed. These conditions are maintenance related and are not included in the claim.",
      priorLosses:
        "N/A. The insured reports no prior claims or roof repairs at this property.",
      mold: "No visible mold was observed during the inspection.",
      contents: "No personal property damage was presented for inspection or observed at the time of the site visit.",
      ems: "N/A. No mitigation company was used by the insured or the Public Adjuster, and none was provided by the carrier. No interior water intrusion has occurred, and the roof is currently watertight.",
      ale: "The home is fully habitable; no Additional Living Expense(s) anticipated.",
      subrogation:
        "There does not appear to be any subrogation potential for this claim, as the damages arise from a weather event and no third-party involvement was identified.",
    },
  },
  "BL-26-0004": {
    status: "FINAL",
    header: {
      reportDate: "4/14/2026",
      dateInspected: "4/10/2026",
      taskCompleted: "4/14/2026",
      formType: "UPCIC HO3 06 22",
      policyType:
        "Coverage applies to risks of direct physical loss to the dwelling, subject to policy exclusions; personal property is covered for named perils, including fire and smoke.",
      effectiveDate: "11/1/2025",
      coverageA: "$ 295,000.00",
      coverageB: "$ 29,500.00",
      coverageC: "$ 147,500.00",
      coverageD: "$ 59,000.00",
    },
    sections: {
      assignmentNotes: [
        "Initial contact was made with the insured, Aisha Coleman, on 4/8/2026.",
        "The inspection took place on 4/10/2026.",
        "The carrier's assigned field adjuster is Darren Moss, and the desk adjuster (claims examiner) is Sandra Blake.",
        "A certified copy of the policy was requested from the carrier on 4/8/2026 and received on 4/13/2026.",
      ].join("\n"),
      riskOccupancy:
        "The insured property is a two-story, single-family residence located at 215 Magnolia St, Orlando, FL 32801. The structure is of wood-frame construction over a concrete slab with lap siding and an asphalt shingle roof, originally built in 1998 with a kitchen remodel completed in 2021. The home is owner-occupied by the named insured and her two children. At the time of inspection, the home was unoccupied and secured, with board-up over the kitchen window and rear door.",
      inspection:
        "The risk was inspected on April 10, 2026, with the Public Adjuster, the Insured, and the carrier's field adjuster present. The claim involves a kitchen grease fire on April 7, 2026, that was extinguished by Orange County Fire Rescue. All rooms on both floors, the attic, and the exterior were documented and photographed. Direct fire damage was confined to the kitchen, where the range, upper cabinets, and ceiling were consumed or charred and the roof framing above the kitchen was exposed. Heavy smoke and soot deposits were present throughout the first floor, and a lighter, uniform soot film was observed on the second floor and in the HVAC return grilles. A strong smoke odor was present throughout the home.",
      causeOfLoss:
        "Based on the fire department report and the conditions observed during the inspection, the loss originated from a cooking fire on the range top that extended to the upper cabinets and ceiling. The burn patterns, including the V-pattern on the wall behind the range, and the fire department narrative are consistent with an accidental cooking fire. No indication of an incendiary origin was observed. Smoke and soot migrated through the open floor plan, the stairwell, and the HVAC system to the remainder of the home.",
      causeOfLossStatement: "Fire and smoke — accidental cooking fire originating at the kitchen range.",
      originOfLoss: "Kitchen range top, extending to the upper cabinets, ceiling, and roof framing above the kitchen.",
      recommendations:
        "Inspection findings support a covered fire loss. The kitchen requires a full gut and rebuild, including cabinetry, countertops, appliances, electrical, drywall, and the charred ceiling joists and roof sheathing above the range. All remaining rooms require cleaning and sealing of smoke-affected surfaces, and the HVAC system requires duct cleaning and likely replacement of the air handler given the soot in the cabinet. An Xactimate estimate has been prepared. A structural engineer should verify the condition of the roof framing above the kitchen, and an industrial hygienist should perform post-cleaning soot testing. The carrier's partial rebuild estimate omits the second-floor cleaning and the HVAC system, and a supplement will be submitted.",
      riskAlert:
        "The roof framing above the kitchen is charred and the ceiling has partially collapsed; the kitchen should not be entered until it has been shored or demolished. Electrical service to the kitchen circuits was disconnected by the fire department.",
      damages: [
        "KITCHEN: Charred and consumed upper cabinets, range, and range hood; heat-damaged lower cabinets and countertop; ceiling drywall partially collapsed; charring to the ceiling joists and roof sheathing above the range.",
        "FAMILY ROOM: Heavy soot on the walls, ceiling, and ceiling fan; heat-blistered paint on the wall shared with the kitchen.",
        "DINING ROOM: Heavy soot deposits on all surfaces and on the light fixture; smoke webbing at the ceiling corners.",
        "STAIRWELL & 2ND FLOOR HALLWAY: Soot film on the walls, ceilings, and handrail; smoke odor.",
        "BEDROOMS (3): Light soot film on the walls, ceilings, and window blinds; smoke odor in the carpet.",
        "HVAC: Soot in the return grilles, ductwork, and air handler cabinet.",
        "ROOF: Charred sheathing and heat-damaged shingles above the kitchen.",
      ].join("\n"),
      nonRelatedDamage:
        "Minor water staining on the garage ceiling was observed and is attributed by the insured to a prior roof leak repaired in 2023. This condition is not related to the fire and is not included in the claim.",
      priorLosses:
        "N/A. The insured reports no prior losses at this property, and no prior repairs were observed during the inspection.",
      mold:
        "No visible mold was observed during the inspection. Water used to extinguish the fire was limited to the kitchen and has been extracted by the mitigation contractor.",
      contents:
        "Contents throughout the home were affected by smoke and soot, and the kitchen contents were destroyed. A contents pack-out was performed by the mitigation company on April 9, 2026, and the pack-out inventory has been requested. The insured is preparing an itemized inventory of non-salvageable items with the Public Adjuster's assistance. The Coverage C limit is $147,500.00.",
      ems:
        "ServPro of Downtown Orlando was selected and contracted by the insured, with the Public Adjuster's assistance, on April 8, 2026; the carrier did not provide a mitigation vendor. ServPro performed emergency board-up, water extraction in the kitchen, and a contents pack-out on April 8–9, 2026, and air scrubbers and hydroxyl generators were operating on the first floor at the time of inspection. The signed work authorization, mitigation invoice, equipment logs, and pack-out inventory have been requested for submission to the carrier.",
      ale:
        "The home is not habitable due to the loss of the kitchen and electrical service and the smoke conditions throughout. The insured and her two children are staying in a short-term rental at $185.00 per night beginning April 8, 2026. Receipts are being collected, and an Additional Living Expense advance has been requested under Coverage D ($59,000.00 limit). The carrier has issued a $25,000.00 advance on the claim.",
      subrogation:
        "There does not appear to be any subrogation potential. The fire department attributed the loss to unattended cooking, and no recall was identified for the range. The range has been retained in case the carrier wishes to inspect it for a product defect.",
    },
  },
  "BL-26-0005": {
    status: "FINAL",
    header: {
      reportDate: "1/26/2026",
      dateInspected: "1/22/2026",
      taskCompleted: "1/26/2026",
      formType: "FPIC HO3 01 24",
      policyType:
        "Coverage applies to risks of direct physical loss to the dwelling and other structures, subject to policy exclusions; personal property is covered for named perils.",
      effectiveDate: "5/15/2025",
      coverageA: "$ 410,000.00",
      coverageB: "$ 8,200.00",
      coverageC: "$ 102,500.00",
      coverageD: "$ 41,000.00",
    },
    sections: {
      assignmentNotes: [
        "Initial contact was made with the insured, Thomas Brennan, on 1/19/2026.",
        "The inspection took place on 1/22/2026.",
        "The carrier's assigned field adjuster is Greg Hale, and the desk adjuster (claims examiner) is Helen Cho.",
        "A certified copy of the policy was requested from the carrier on 1/19/2026 and received on 1/23/2026.",
      ].join("\n"),
      riskOccupancy:
        "The insured property is a one-story, single-family residence located at 78 Seagate Ln, Naples, FL 34102. The structure is of concrete block construction with a stucco finish and a hip roof covered in concrete barrel tile. A screened pool enclosure with an aluminum frame is attached to the rear of the home. The home is owner-occupied as the insured's primary residence.",
      inspection:
        "The risk was inspected on January 22, 2026, with the Public Adjuster and Insured present. The claim involves a reported windstorm on January 17, 2026, resulting in damage to the tile roof and the screened pool enclosure. The roof, exterior elevations, pool enclosure, and interior were documented and photographed. Displaced, cracked, and missing barrel tiles were observed at the hips and along the eaves of the south and east slopes. The pool enclosure had two bent aluminum purlins and torn screen panels across the south wall. The interior inspection revealed a small ceiling stain in the living room below the east slope.",
      causeOfLoss:
        "Based on the conditions observed during the inspection, the damages are consistent with wind forces from the January 17, 2026 storm. Tile displacement at the hips and eaves, where uplift pressures are greatest, and the direction of the enclosure damage are consistent with the reported wind direction. The interior ceiling stain is consistent with rainwater entering beneath displaced tiles on the east slope.",
      causeOfLossStatement:
        "Windstorm — wind uplift damage to the tile roof and pool enclosure, with ensuing interior water staining.",
      originOfLoss: "Hips and eaves of the south and east roof slopes; south wall of the pool enclosure.",
      recommendations:
        "Inspection findings support a covered windstorm loss. The concrete barrel tile is no longer manufactured in a matching profile and color, and the damaged tiles span multiple slopes; replacement of the roof covering is recommended to achieve a reasonably uniform appearance. The pool enclosure requires replacement of the bent purlins and re-screening of the south wall. An Xactimate estimate has been prepared and will be submitted with photographs. The hurricane deductible does not apply because no hurricane watch or warning was issued for Collier County; the All Other Perils deductible applies.",
      riskAlert:
        "Loose tiles at the east hip present a falling hazard near the front entry. The insured was advised to keep the entry area clear until the tiles are secured.",
      damages: [
        "ROOF: Cracked, displaced, and missing concrete barrel tiles at the hips and along the eaves of the south and east slopes (approximately 85 tiles), with dislodged hip mortar.",
        "POOL ENCLOSURE: Two bent aluminum purlins and torn screen panels across the south wall.",
        "LIVING ROOM: Water stain on the ceiling drywall measuring approximately 3' x 4' below the east slope; no elevated moisture readings at the time of inspection.",
      ].join("\n"),
      nonRelatedDamage:
        "Efflorescence and minor hairline stucco cracking on the north elevation were observed and are consistent with age and weathering. These conditions are not related to the storm and are not included in the claim.",
      priorLosses:
        "The insured reported a prior hurricane claim in 2022 (Hurricane Ian) for roof tile and enclosure damage, repaired in 2023. Repair invoices were provided and show that the roof was fully re-tiled in 2023, confirming that the current damage is new.",
      mold: "No visible mold was observed during the inspection.",
      contents: "No personal property damage was presented for inspection or observed at the time of the site visit.",
      ems:
        "No mitigation company was required, and none was provided by the carrier. Gulf Tile Roofing, selected and contracted by the insured, secured loose tiles and installed a temporary underlayment patch at the east slope on January 18, 2026. The invoice for the temporary repair has been obtained and will be submitted to the carrier.",
      ale: "The home is fully habitable; no Additional Living Expense(s) anticipated.",
      subrogation:
        "There does not appear to be any subrogation potential for this claim, as no third-party involvement was identified during the inspection.",
    },
  },
};

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Report Details on the demo claims; only blank fields are filled. */
const DETAILS: Record<string, Prisma.ClaimUpdateInput> = {
  "BL-26-0002": {
    initialContactDate: day("2026-08-06"),
    lossInspectedDate: day("2026-08-12"),
    certifiedPolicyRequestedDate: day("2026-08-07"),
    dwellingType: "single-family residence",
    stories: 2,
    constructionType: "masonry first-floor and wood-frame second-floor",
    roofCovering: "hip roof covered in dimensional asphalt shingles",
    occupancy: "OWNER_OCCUPIED",
    inspectionAttendees: "both named insureds",
    originOfLoss: "South and west roof slopes above the primary bedroom and second-floor hallway.",
    moldObserved: false,
    contentsDamaged: true,
    mitigationCompany: "Dry Pro Restoration",
    mitigationEngagedBy: "PUBLIC_ADJUSTER",
    mitigationStartDate: day("2026-08-13"),
    mitigationServices: "Moisture mapping and structural drying of the primary bedroom and second-floor hallway",
    homeHabitable: true,
  },
  "BL-26-0003": {
    initialContactDate: day("2026-08-06"),
    lossInspectedDate: day("2026-08-10"),
    certifiedPolicyRequestedDate: day("2026-08-11"),
    dwellingType: "single-family residence",
    stories: 1,
    yearBuilt: 1987,
    constructionType: "concrete block with a stucco finish",
    roofCovering: "gable roof covered in three-tab asphalt shingles",
    occupancy: "OWNER_OCCUPIED",
    originOfLoss: "All roof slopes, heaviest on the west and north elevations, and the east-side HVAC condenser.",
    priorLosses: "N/A. The insured reports no prior claims or roof repairs at this property.",
    moldObserved: false,
    contentsDamaged: false,
    mitigationEngagedBy: "NONE",
    homeHabitable: true,
    subrogationNotes:
      "There does not appear to be any subrogation potential for this claim, as the damages arise from a weather event and no third-party involvement was identified.",
  },
  "BL-26-0004": {
    initialContactDate: day("2026-04-08"),
    lossInspectedDate: day("2026-04-10"),
    certifiedPolicyRequestedDate: day("2026-04-08"),
    certifiedPolicyReceivedDate: day("2026-04-13"),
    dwellingType: "single-family residence",
    stories: 2,
    yearBuilt: 1998,
    constructionType: "wood-frame",
    roofCovering: "asphalt shingle roof",
    occupancy: "OWNER_OCCUPIED",
    inspectionAttendees: "the Insured and the carrier's field adjuster",
    originOfLoss: "Kitchen range top, extending to the upper cabinets, ceiling, and roof framing above the kitchen.",
    priorLosses: "N/A. The insured reports no prior losses at this property.",
    moldObserved: false,
    contentsDamaged: true,
    mitigationCompany: "ServPro of Downtown Orlando",
    mitigationEngagedBy: "INSURED",
    mitigationStartDate: day("2026-04-08"),
    mitigationServices: "Emergency board-up, kitchen water extraction, air scrubbers and hydroxyl generators, and a contents pack-out",
    homeHabitable: false,
    aleDetails: "The insured and her two children are staying in a short-term rental at $185.00 per night beginning April 8, 2026.",
  },
  "BL-26-0005": {
    initialContactDate: day("2026-01-19"),
    lossInspectedDate: day("2026-01-22"),
    certifiedPolicyRequestedDate: day("2026-01-19"),
    certifiedPolicyReceivedDate: day("2026-01-23"),
    dwellingType: "single-family residence",
    stories: 1,
    constructionType: "concrete block with a stucco finish",
    roofCovering: "hip roof covered in concrete barrel tile",
    occupancy: "OWNER_OCCUPIED",
    originOfLoss: "Hips and eaves of the south and east roof slopes; south wall of the pool enclosure.",
    moldObserved: false,
    contentsDamaged: false,
    mitigationEngagedBy: "NONE",
    mitigationServices:
      "Gulf Tile Roofing, selected and contracted by the insured, secured loose tiles and installed a temporary underlayment patch on January 18, 2026",
    homeHabitable: true,
  },
};

async function fillBlankDetails(claimId: string, details: Prisma.ClaimUpdateInput) {
  const current = (await prisma.claim.findUniqueOrThrow({ where: { id: claimId } })) as Record<
    string,
    unknown
  >;
  const data = Object.fromEntries(
    Object.entries(details).filter(([key]) => current[key] === null || current[key] === undefined)
  );
  if (Object.keys(data).length) await prisma.claim.update({ where: { id: claimId }, data });
  return Object.keys(data).length;
}

async function main() {
  const actor =
    (await prisma.adjuster.findFirst({
      where: { email: "miguel.fernandez@blacklineadjusting.com", isActive: true },
      select: { id: true, name: true },
    })) ??
    (await prisma.adjuster.findFirst({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!actor) throw new Error("No active admin to record the sample reports.");
  const refresh = process.argv.includes("--refresh");

  for (const [claimNumber, input] of Object.entries(SAMPLES)) {
    const claim = await prisma.claim.findUnique({
      where: { claimNumber },
      select: { id: true, summaryReport: { select: { id: true } } },
    });
    if (!claim) {
      console.log(`${claimNumber}: not in this database — skipped`);
      continue;
    }
    const filled = DETAILS[claimNumber] ? await fillBlankDetails(claim.id, DETAILS[claimNumber]) : 0;
    if (filled) console.log(`${claimNumber}: filled ${filled} blank report detail fields`);
    if (claim.summaryReport && !refresh) {
      console.log(`${claimNumber}: already has a report — left as is`);
      continue;
    }
    await saveSummaryReport({ claimId: claim.id, actorId: actor.id, via: "BLACKBOX", input });
    console.log(
      `${claimNumber}: sample report ${claim.summaryReport ? "refreshed" : "created"} (${input.status}) → /claims/${claim.id}/summary-report`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
