import { RAMS_DISCLAIMER } from "./disclaimer";

export const RAMS_TRADES = [
  { value: "PLUMBING_HEATING", label: "Plumbing and heating" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "ROOFING", label: "Roofing" },
  { value: "CARPENTRY_JOINERY", label: "Carpentry and joinery" },
  { value: "DECORATING", label: "Decorating" },
  { value: "GROUNDWORKS_LANDSCAPING", label: "Groundworks and landscaping" },
  { value: "GENERAL_BUILDING", label: "General building" },
] as const;

export type RamsTradeValue = (typeof RAMS_TRADES)[number]["value"];

export function isRamsTrade(value: string): value is RamsTradeValue {
  return RAMS_TRADES.some((item) => item.value === value);
}

export function ramsTradeLabel(trade: string): string {
  return RAMS_TRADES.find((item) => item.value === trade)?.label ?? "Trade";
}

/** The trader profile still uses the shorter trade list. RAMS can be more specific. */
export function defaultRamsTrade(traderTrade: string): RamsTradeValue {
  if (traderTrade === "PLUMBING_HEATING") return "PLUMBING_HEATING";
  if (traderTrade === "ELECTRICAL") return "ELECTRICAL";
  if (traderTrade === "BUILDING") return "GENERAL_BUILDING";
  return "GENERAL_BUILDING";
}

export type LibraryHazard = {
  key: string;
  activity: string;
  hazard: string;
  whoHarmed: string;
  likelihoodBefore: number;
  severityBefore: number;
  controls: string;
  likelihoodAfter: number;
  severityAfter: number;
  keywords: string[];
  core?: boolean;
};

export type LibrarySubstance = {
  name: string;
  hazard: string;
  controls: string;
  keywords: string[];
  usual?: boolean;
};

export type LibraryPermit = {
  name: string;
  detail: string;
  keywords: string[];
  usual?: boolean;
};

export type TradePack = {
  trade: RamsTradeValue;
  ppe: string[];
  method: string[];
  hazards: LibraryHazard[];
  substances: LibrarySubstance[];
  permits: LibraryPermit[];
};

export const EMERGENCY_NOTES = [
  "In an emergency call 999 and ask for the service you need. Give them the site address on this RAMS.",
  "Stop work. Make the area safe if you can do that without further risk, and check everyone on the job is accounted for. Warn the client or the main contractor.",
  "The nearest accident and emergency department is the one named on this RAMS. If that line is blank, find it before work starts and write it in.",
  "Injuries, diseases and dangerous occurrences that fall under RIDDOR are reported to the HSE within the time limits on the HSE website. Quotestick does not send that report.",
  "Where a main contractor runs the site, follow their emergency plan and assembly point as well as this one.",
].join("\n\n");

export const FIRST_AID_NOTES = [
  "A stocked first-aid kit is kept with the tools and checked before the job. The competent person named on this RAMS knows where it is.",
  "For a serious injury call 999. For a lesser injury use the kit, then go to the nearest A&E or a minor injuries unit if that is the right place.",
  "Write down what happened. If it is reportable under RIDDOR, the business reports it to the HSE. This RAMS does not send the report.",
].join("\n\n");

export const WELFARE_NOTES = [
  "Provide welfare that suits the length of the job, in line with CDM 2015: drinking water, a place to wash hands, a toilet, and somewhere to rest and eat.",
  "On a short domestic visit, agree with the client before you use their facilities. On a site run by a main contractor, use the site welfare and attend the induction.",
  "Do not start a longer job if welfare is missing.",
].join("\n\n");

const SHARED_CLOSING = [
  "If a main contractor runs the site, sign in, take the induction, and follow their permits as well as this RAMS.",
  "Stop if the site or the scope is not what this RAMS describes. Tell the competent person and revise it before you carry on.",
];

function hazard(
  key: string,
  activity: string,
  hazardText: string,
  whoHarmed: string,
  beforeL: number,
  beforeS: number,
  controls: string,
  afterL: number,
  afterS: number,
  keywords: string[] = [],
  core = false,
): LibraryHazard {
  return {
    key,
    activity,
    hazard: hazardText,
    whoHarmed,
    likelihoodBefore: beforeL,
    severityBefore: beforeS,
    controls,
    likelihoodAfter: afterL,
    severityAfter: afterS,
    keywords,
    core,
  };
}

const asbestos = (key: string, activity: string, keywords: string[]): LibraryHazard =>
  hazard(
    key,
    activity,
    "Breathing asbestos fibres if old materials are cut, sanded or broken",
    "Operatives and people in the property",
    2,
    5,
    "Stop if you suspect asbestos. Do not cut, sand or scrape it. On a managed site, ask for the refurbishment and demolition survey before intrusive work. Tell a domestic client before anything suspicious is disturbed.",
    1,
    5,
    keywords,
  );

const PACKS: TradePack[] = [
  {
    trade: "PLUMBING_HEATING",
    ppe: [
      "Safety footwear",
      "Gloves that suit the task, and none near a rotating bit",
      "Eye protection when drilling or soldering",
      "Knee pads for floor work",
      "FFP3 mask if insulation or dust is disturbed",
    ],
    method: [
      "Walk the job with the client or the site manager. Find the stopcock, the way out, and any spur you may need to isolate.",
      "Protect floors and agree which rooms stay in use. Keep children and pets out of the work area.",
      "Isolate the water, and the electrics where a pump or immersion is involved, before you open pipework. Prove they are off.",
      "Do the work in the order agreed. Follow the controls in this risk assessment, including any permit the job needs.",
      "Keep waste in a bag. Do not leave blades, flux or offcuts on the floor.",
      "Bring the supply back slowly. Check joints under pressure. Check hot-water outlet temperature before you hand the job over.",
      "Remove protections, clean up, and walk the finished work with the client or main contractor.",
    ],
    hazards: [
      hazard(
        "plumb-access",
        "Moving around the property",
        "Slips and trips on wet floors, tools and cables",
        "Client, occupants and operatives",
        3,
        3,
        "Keep a clear route, wipe spills as you go, keep cables out of the walkway, and work in decent light.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "plumb-handling",
        "Lifting sanitaryware, cylinders and tools",
        "Musculoskeletal injury",
        "Operatives",
        3,
        3,
        "Assess the load. Use a second person or a trolley for heavy items. Keep the route clear before you lift.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "plumb-isolation",
        "Isolating and opening the water supply",
        "Uncontrolled release of water, damage and slips",
        "Client, the property and operatives",
        3,
        3,
        "Find the stopcock before you open pipework. Warn the client. Have a bucket and towels. Prove the supply is off, then bring it back slowly and check every joint.",
        2,
        2,
        ["tap", "leak", "pipe", "outside"],
        true,
      ),
      hazard(
        "plumb-people",
        "Other people in the home",
        "Contact with tools or open pipework",
        "Occupants, especially children",
        3,
        3,
        "Agree a work area. Do not leave an open hole, a blade or a hot tool unattended. Stop if someone comes into the area.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "plumb-height",
        "Ladders, lofts and tanks above head height",
        "Fall from height",
        "Operatives",
        3,
        4,
        "Use a hop-up or a podium for short work. Board a loft before you stand on it. Do not overreach. Follow the Work at Height Regulations. A ladder is for short, light work only.",
        1,
        4,
        ["ladder", "loft", "attic", "height", "tank"],
      ),
      hazard(
        "plumb-scald",
        "Hot water outlets and cylinders",
        "Scalding",
        "Occupants and operatives",
        3,
        4,
        "Let stored water cool before you drain it. Check outlet temperature on baths and showers. Unvented cylinders need a competent person and a correct discharge route.",
        2,
        3,
        ["hot water", "cylinder", "unvented", "shower", "bath", "scald"],
      ),
      hazard(
        "plumb-gas",
        "Gas appliances, pipework and flues",
        "Fire, explosion or carbon monoxide",
        "Occupants and operatives",
        2,
        5,
        "Only a Gas Safe registered engineer works on gas, and only on appliances their registration covers. Tightness test, check the flue, and confirm a CO alarm. Stop if you are not registered for that work.",
        1,
        5,
        ["gas", "boiler", "flue", "hob", "combi", "carbon monoxide"],
      ),
      hazard(
        "plumb-legionella",
        "Stored water and little-used outlets",
        "Legionella",
        "Occupants",
        2,
        4,
        "Avoid long dead legs. Flush outlets after the work. Keep hot water hot and cold water cold. Clean shower heads you have disturbed.",
        1,
        4,
        ["legionella", "cold tank", "storage cistern", "dead leg"],
      ),
      hazard(
        "plumb-hotworks",
        "Soldering and blowlamps",
        "Fire",
        "The property and occupants",
        3,
        4,
        "Clear combustibles, keep a damp cloth and an extinguisher to hand, and stay to watch the area afterwards. Use a hot-works permit where the main contractor requires one.",
        2,
        3,
        ["solder", "blowlamp", "blow torch", "hot works", "torch"],
      ),
      hazard(
        "plumb-electric",
        "Pumps, immersion heaters and controls",
        "Electric shock",
        "Operatives",
        2,
        5,
        "Isolate at the spur or the consumer unit and prove dead. Do not work live. Do not alter fixed wiring unless you are competent and, where required, registered to do so.",
        1,
        5,
        ["immersion", "pump", "wiring", "electric", "spur", "fuse"],
      ),
      hazard(
        "plumb-drill",
        "Drilling masonry for fixings",
        "Dust, noise and eye injury",
        "Operatives and occupants nearby",
        3,
        3,
        "Eye protection, hearing protection if the drilling lasts, and a dust sheet. Ask about hidden pipes and cables before you drill.",
        2,
        2,
        ["drill", "fixing", "masonry", "wall"],
      ),
      asbestos("plumb-asbestos", "Old tanks, flues, insulation and artex", ["asbestos", "artex", "pre-2000"]),
    ],
    substances: [
      {
        name: "Flux",
        hazard: "Irritant. Fumes when heated.",
        controls: "Use sparingly, ventilate, wear gloves, and wash your hands before you eat.",
        keywords: ["solder", "flux", "copper"],
        usual: true,
      },
      {
        name: "Solder",
        hazard: "Fumes. Older solder may contain lead.",
        controls: "Use lead-free solder on wholesome water. Ventilate. Do not eat with residue on your hands.",
        keywords: ["solder"],
      },
      {
        name: "Jointing compound",
        hazard: "Low hazard. Can irritate eyes and skin.",
        controls: "Gloves. Keep it off skin. Follow the tin.",
        keywords: ["joint", "ptfe"],
        usual: true,
      },
      {
        name: "System cleaner or inhibitor",
        hazard: "Irritant. Can harm drains and watercourses if tipped away.",
        controls: "Follow the label. Gloves and eye protection. Do not pour spent chemical down a drain unless the label allows it.",
        keywords: ["inhibitor", "powerflush", "sludge", "radiator", "heating"],
      },
      {
        name: "Descaler or disinfectant",
        hazard: "Irritant or corrosive, depending on the product.",
        controls: "Read the COSHH information on the label. Gloves, eye protection, and ventilation. Do not mix with other chemicals.",
        keywords: ["descale", "bleach", "toilet", "shower head"],
      },
    ],
    permits: [
      {
        name: "Hot works",
        detail: "Tick this for soldering or a blowlamp. Clear combustibles, keep an extinguisher, and watch the area afterwards.",
        keywords: ["solder", "blowlamp", "blow torch", "hot works", "torch"],
      },
      {
        name: "Working at height",
        detail: "Tick this for ladders, lofts or any work where a fall could cause injury. Prefer a hop-up, podium or scaffold.",
        keywords: ["ladder", "loft", "attic", "height", "tank"],
      },
      {
        name: "Electrical isolation",
        detail: "Tick this when a pump, immersion or control must be isolated. Lock off and prove dead.",
        keywords: ["immersion", "pump", "wiring", "electric", "spur"],
      },
      {
        name: "Confined space",
        detail: "Tick this for a tank, chamber or any space with poor ventilation. Do not enter alone.",
        keywords: ["confined", "chamber", "manhole", "inside the tank"],
      },
      {
        name: "Asbestos",
        detail: "Tick this if intrusive work may disturb asbestos. Stop until you know what the material is.",
        keywords: ["asbestos", "artex"],
      },
    ],
  },
  {
    trade: "ELECTRICAL",
    ppe: [
      "Safety footwear",
      "Insulated tools and a proving device",
      "Lock-off kit",
      "Eye protection when drilling",
      "FFP3 mask for chasing or heavy dust",
    ],
    method: [
      "Ask about medical equipment, alarms, boilers and anything that must stay on before you isolate.",
      "Identify the circuit. Safe isolation: lock off, prove the tester, prove dead, prove the tester again. No live working.",
      "Keep the board covered when you are not at it. Keep people out of the work area.",
      "Do the work to BS 7671. Do not exceed the work your competence and registration cover.",
      "Test the finished work and record the results the way your scheme requires.",
      "Label the board, replace covers, and tell the client what was isolated and what they need to reset.",
    ],
    hazards: [
      hazard(
        "elec-shock",
        "Working on fixed wiring",
        "Electric shock, burns and fire from live parts",
        "Operatives and occupants",
        3,
        5,
        "Safe isolation under the Electricity at Work Regulations. Lock off, prove dead, and do not work live. Use insulated tools.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "elec-people",
        "Occupants using the installation",
        "Shock, or loss of supply to medical equipment and alarms",
        "Occupants",
        3,
        4,
        "Agree the outage. Ask about medical equipment and alarms first. Label the board. Do not leave it open.",
        1,
        4,
        [],
        true,
      ),
      hazard(
        "elec-access",
        "Working around an open board",
        "Slips, trips and contact with tools",
        "Occupants and operatives",
        3,
        3,
        "Keep a clear area, tools in a bag, and covers on before you leave the board.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "elec-handling",
        "Boards, cable and ladders",
        "Musculoskeletal injury",
        "Operatives",
        3,
        3,
        "Cut drums down to a liftable size. Two people for an awkward consumer unit. Do not twist while you carry.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "elec-height",
        "Lights, downlights and loft wiring",
        "Fall from height",
        "Operatives",
        3,
        4,
        "Hop-up or podium for short work. A tower where the work is above a stair or will take time. Inspect it before use. Do not overreach.",
        1,
        4,
        ["light", "loft", "downlight", "ladder", "height", "ceiling"],
      ),
      hazard(
        "elec-fire",
        "Terminations and protective devices",
        "Fire from a poor connection or an overloaded circuit",
        "Occupants and the property",
        3,
        4,
        "Torque or tighten terminals correctly. Do not overfill boxes. Test and certify. Replace damaged accessories rather than leaving them.",
        2,
        3,
        ["consumer", "board", "rewire", "socket", "fire"],
      ),
      hazard(
        "elec-dust",
        "Chasing and drilling",
        "Dust, noise and hand-arm vibration",
        "Operatives and occupants",
        3,
        3,
        "Extraction or suppression, eye and hearing protection, and FFP3 for significant dust. Limit trigger time.",
        2,
        2,
        ["chase", "drill", "wall", "cut"],
      ),
      hazard(
        "elec-stored",
        "Solar, battery storage and EV chargers",
        "DC shock and stored energy",
        "Operatives",
        3,
        5,
        "Isolate AC and DC. Follow the manufacturer. Do not take the work on if you are not qualified for that system.",
        1,
        5,
        ["solar", "pv", "battery", "ev", "charger", "inverter"],
      ),
      asbestos("elec-asbestos", "Old boards, flash guards, bitumen cable and artex", ["asbestos", "artex", "flash guard", "bitumen"]),
    ],
    substances: [
      {
        name: "Cable lubricant",
        hazard: "Irritant to skin and eyes.",
        controls: "Gloves. Wash off. Keep it out of eyes.",
        keywords: ["cable", "pull"],
        usual: true,
      },
      {
        name: "Expanding foam or sealant",
        hazard: "Irritant. Some products give off vapour while they cure.",
        controls: "Ventilate. Gloves. Read the label. Do not use a large amount in a small unventilated space.",
        keywords: ["foam", "sealant"],
      },
      {
        name: "Solvent cleaner",
        hazard: "Flammable vapour. Can irritate skin.",
        controls: "Use a little, ventilate, no hot works nearby, and keep the cap on.",
        keywords: ["clean", "contact"],
      },
    ],
    permits: [
      {
        name: "Electrical isolation",
        detail: "Required for work on fixed wiring. Lock off and prove dead before you start.",
        keywords: [],
        usual: true,
      },
      {
        name: "Working at height",
        detail: "Tick this for lights, lofts and any work where a fall could cause injury.",
        keywords: ["light", "loft", "ladder", "height", "ceiling"],
      },
      {
        name: "Asbestos",
        detail: "Tick this before drilling textured coatings or disturbing old board materials.",
        keywords: ["asbestos", "artex"],
      },
    ],
  },
  {
    trade: "ROOFING",
    ppe: [
      "Safety footwear with a grip",
      "Gloves",
      "Hard hat where people work below or the site requires one",
      "Eye protection when cutting",
      "Harness only where collective protection will not work, and only with an anchor and a rescue plan",
    ],
    method: [
      "Check the weather. Do not go up in high wind, ice or heavy rain.",
      "Set exclusion zones below. Agree scaffold, a tower or another working platform before anyone climbs. A harness is not a substitute for edge protection on a typical domestic roof.",
      "Get materials up in small loads. Do not throw anything down.",
      "Treat cement sheets, old garage roofs and roof lights as fragile until shown otherwise. Do not walk them.",
      "Do the covering, flashings and dry details in the agreed order. Hot works only with the controls in this RAMS.",
      "Check the finished work from the platform, clear the gutters you have disturbed, and leave the site fenced or the scaffold safe overnight.",
    ],
    hazards: [
      hazard(
        "roof-fall",
        "Working on the roof",
        "Fall from height",
        "Operatives",
        4,
        5,
        "Edge protection and a scaffold or tower are the default. Do not start without them. Follow the Work at Height Regulations. Inspect the scaffold before use.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "roof-below",
        "Materials and tools at height",
        "Someone below is struck",
        "Public and other workers",
        3,
        5,
        "Exclusion zone, brick guards or fans, tools tied or bagged, and nothing thrown from the roof.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "roof-handling",
        "Tiles, timber, felt and lead",
        "Musculoskeletal injury and cuts",
        "Operatives",
        3,
        3,
        "Small bundles. A hoist where the load is heavy. Gloves. Keep the landing area clear.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "roof-weather",
        "Wind, rain, ice and sun",
        "Loss of balance, or heat illness",
        "Operatives",
        3,
        4,
        "Stop in high wind or ice. Check the forecast before you start. Water and shade in hot weather. Do not lay materials outside the maker's weather limits.",
        2,
        3,
        [],
        true,
      ),
      hazard(
        "roof-fragile",
        "Fragile roofs and roof lights",
        "Fall through the roof",
        "Operatives",
        3,
        5,
        "Treat asbestos cement, old garage roofs and roof lights as fragile. Crawling boards. Do not walk the sheets. Stop if you cannot reach the work from a safe platform.",
        1,
        5,
        ["fragile", "rooflight", "skylight", "garage", "cement sheet", "asbestos"],
      ),
      hazard(
        "roof-hot",
        "Torch-on felt",
        "Fire",
        "The property and people nearby",
        3,
        4,
        "Hot-works controls: clear combustibles, extinguishers on the roof and below, and a fire watch after the torch is out. Gas cylinders secured and off overnight.",
        2,
        3,
        ["torch", "felt", "bitumen", "hot works"],
      ),
      hazard(
        "roof-lead",
        "Lead flashings",
        "Lead exposure",
        "Operatives",
        2,
        3,
        "Gloves, no eating on the roof, wash before you eat, and do not heat lead indoors without extraction.",
        1,
        3,
        ["lead", "flashing"],
      ),
      hazard(
        "roof-public",
        "Scaffold on or beside a pavement",
        "Public struck or forced into the road",
        "Public",
        3,
        4,
        "A pavement licence where one is required. Lighting, a safe walkway or a proper closure, and brick guards.",
        2,
        3,
        ["pavement", "street", "public", "scaffold"],
      ),
      asbestos("roof-asbestos", "Asbestos cement sheets and old soffits", ["asbestos", "cement sheet", "garage"]),
    ],
    substances: [
      {
        name: "Bitumen primer or cold adhesive",
        hazard: "Flammable vapour. Skin irritation.",
        controls: "Ventilate, gloves, no smoking, and keep it away from the torch until the maker says it is ready.",
        keywords: ["bitumen", "felt", "primer"],
        usual: true,
      },
      {
        name: "Roofing torch gas",
        hazard: "Fire and explosion. Asphyxiation in a confined space.",
        controls: "Check hoses, secure the cylinder upright, and turn it off when you stop. Do not store it in the building overnight.",
        keywords: ["torch", "gas", "felt"],
      },
      {
        name: "Lead",
        hazard: "Toxic if swallowed or if fume is breathed.",
        controls: "Gloves, wash hands, no eating on the job, and no indoor burning of lead.",
        keywords: ["lead"],
      },
    ],
    permits: [
      {
        name: "Working at height",
        detail: "Required. Edge protection or a scaffold before anyone goes up.",
        keywords: [],
        usual: true,
      },
      {
        name: "Hot works",
        detail: "Tick this for torch-on felt or any open flame. Fire watch afterwards.",
        keywords: ["torch", "felt", "bitumen", "hot works"],
      },
      {
        name: "Asbestos",
        detail: "Tick this for cement sheets and any suspected asbestos. Do not break the sheets.",
        keywords: ["asbestos", "cement sheet", "garage"],
      },
    ],
  },
  {
    trade: "CARPENTRY_JOINERY",
    ppe: [
      "Safety footwear",
      "Eye protection",
      "Hearing protection for powered cutting",
      "FFP3 mask when sanding or cutting a lot of wood",
      "No gloves at a circular saw or router",
    ],
    method: [
      "Protect the client's floors and agree where sheet materials can stand.",
      "Check each power tool, the guard and the lead before use. Extraction on when it is fitted.",
      "Cut on a stable bench. Keep hands clear of the blade. No gloves near a rotating tool.",
      "Two people for sheet goods and long lengths. Keep routes clear.",
      "Fix in the agreed order. Working at height only from a hop-up, podium or tower.",
      "Bag offcuts and dust as you go. Do not leave nails pointing up.",
      "Walk the finished work and make sure doors, stairs and guards are safe before you leave.",
    ],
    hazards: [
      hazard(
        "carp-tools",
        "Saws, planers and nailers",
        "Cuts, ejected material, noise",
        "Operatives and anyone nearby",
        3,
        4,
        "Guards on, extraction where it is fitted, eye and hearing protection. No gloves near a rotating blade. Only people trained on that tool use it.",
        2,
        3,
        [],
        true,
      ),
      hazard(
        "carp-dust",
        "Cutting and sanding wood",
        "Wood dust. Asthma, and hardwood dust is linked to nasal cancer",
        "Operatives",
        3,
        4,
        "Extraction on the tool, a suitable vacuum, and FFP3 when sanding. Clean with the vacuum, not a brush. COSHH applies to wood dust.",
        2,
        3,
        [],
        true,
      ),
      hazard(
        "carp-handling",
        "Sheet materials and timber",
        "Back injury and dropped loads",
        "Operatives",
        3,
        3,
        "Two people for sheets. Keep the route clear. Do not twist while you carry.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "carp-access",
        "Work inside an occupied home",
        "Trips and damage",
        "Occupants and operatives",
        3,
        2,
        "Dust sheets taped down, a clear walkway, and cables out of the way. Clean as you go.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "carp-height",
        "Stairs, loft hatches, fascia and cladding",
        "Fall from height",
        "Operatives",
        3,
        4,
        "Hop-up, podium or tower. Do not work from the top of a ladder. Edge protection where a fall would be serious.",
        1,
        4,
        ["stair", "loft", "height", "cladding", "fascia", "ladder"],
      ),
      hazard(
        "carp-noise",
        "Longer cutting",
        "Hearing damage and vibration",
        "Operatives",
        3,
        3,
        "Hearing protection, sharp blades so the tool works faster, and breaks from the trigger.",
        2,
        2,
        ["cut", "saw", "router"],
      ),
      asbestos("carp-asbestos", "Old soffits, packing and textured coatings", ["asbestos", "artex", "soffit"]),
    ],
    substances: [
      {
        name: "Wood dust",
        hazard: "Asthmagen. Hardwood dust is also linked to nasal cancer.",
        controls: "Extraction, vacuum clean-up, and FFP3 for sanding. Wash before you eat.",
        keywords: [],
        usual: true,
      },
      {
        name: "Wood glue",
        hazard: "Skin irritation.",
        controls: "Gloves if you are prone to dermatitis. Wash off. Follow the bottle.",
        keywords: ["glue"],
        usual: true,
      },
      {
        name: "Varnish, oil or solvent stain",
        hazard: "Flammable vapour. Dermatitis.",
        controls: "Ventilate, gloves, lids on, and no hot works in the same room.",
        keywords: ["varnish", "oil", "stain", "solvent"],
      },
    ],
    permits: [
      {
        name: "Working at height",
        detail: "Tick this for stairs, lofts, fascia and any work where a fall could cause injury.",
        keywords: ["stair", "loft", "height", "fascia", "ladder", "cladding"],
      },
      {
        name: "Hot works",
        detail: "Tick this if a torch or hot air is used. Unusual for joinery. Keep it away from solvents and dust.",
        keywords: ["torch", "hot works"],
      },
      {
        name: "Asbestos",
        detail: "Tick this before you disturb old soffits or textured coatings.",
        keywords: ["asbestos", "artex", "soffit"],
      },
    ],
  },
  {
    trade: "DECORATING",
    ppe: [
      "Footwear agreed with the client, with a secure grip",
      "Gloves for solvents and prolonged wet work",
      "Eye protection when sanding or scraping",
      "FFP3 when sanding ordinary fillers. Do not sand suspected lead or asbestos",
    ],
    method: [
      "Walk the rooms with the client. Note occupied rooms, children, pets and anything that cannot be moved.",
      "Protect floors and a clear walkway. Set the hop-up or podium before you start at height.",
      "Prepare surfaces with the controls in this RAMS. Do not dry-sand or burn paint that may contain lead, and do not sand textured coatings.",
      "Ventilate while coatings are open. Lids on when you stop.",
      "Keep the work area tidy between coats. Do not leave a tower where someone can climb it.",
      "Remove protections only when the client is happy the coatings are dry enough, and take waste with you.",
    ],
    hazards: [
      hazard(
        "deco-coshh",
        "Paints, solvents and fillers",
        "Vapour, dermatitis and fire from solvents",
        "Operatives and occupants",
        3,
        3,
        "Read the label. Ventilate. Gloves. No smoking and no hot works near solvents. Prefer the lower-solvent product where the specification allows.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "deco-height",
        "Walls, ceilings and stairwells",
        "Fall from height",
        "Operatives",
        3,
        4,
        "Podium or hop-up, not the top step of a ladder. A tower for a stairwell, with the brakes on. Follow the Work at Height Regulations.",
        2,
        4,
        [],
        true,
      ),
      hazard(
        "deco-access",
        "Dust sheets and cables",
        "Trips",
        "Occupants and operatives",
        3,
        2,
        "Tape sheets down and keep one clear walkway. Tell the client which rooms are out of use.",
        2,
        1,
        [],
        true,
      ),
      hazard(
        "deco-handling",
        "Tubs, boards and towers",
        "Musculoskeletal injury",
        "Operatives",
        3,
        3,
        "Do not overfill a scuttle. Move a tower with two people, brakes checked, nobody on it.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "deco-lead",
        "Older joinery and pre-1970s paint",
        "Lead exposure",
        "Operatives and occupants, including children",
        3,
        4,
        "Do not burn off or dry-sand paint that may contain lead. Assume lead on old joinery unless it has been shown otherwise. Wet methods, gloves, and clean the room before it is handed back.",
        1,
        4,
        ["lead", "sash", "pre-1960", "pre-1970", "burn off"],
      ),
      hazard(
        "deco-steam",
        "Steam stripping",
        "Scalds and slips",
        "Operatives",
        3,
        3,
        "Gloves, the cable behind you, and no overreach from the hop-up. Mop water as you go.",
        2,
        2,
        ["steam", "strip"],
      ),
      asbestos("deco-asbestos", "Textured coatings such as Artex", ["artex", "textured", "asbestos"]),
    ],
    substances: [
      {
        name: "Water-based paint",
        hazard: "Skin irritation from prolonged contact. Isothiazolinones in some tins can sensitise skin.",
        controls: "Gloves if you are decorating all day. Wash before you eat. Follow the tin.",
        keywords: [],
        usual: true,
      },
      {
        name: "Solvent-based paint or white spirit",
        hazard: "Flammable vapour. Dermatitis.",
        controls: "Ventilate, gloves, no ignition sources, and rags stored safely so they cannot heat up.",
        keywords: ["gloss", "white spirit", "solvent", "oil"],
      },
      {
        name: "Filler",
        hazard: "Dust when sanded. Some fillers irritate skin.",
        controls: "Sand lightly with extraction or a mask. Do not sand a textured coating.",
        keywords: ["filler", "sand"],
        usual: true,
      },
    ],
    permits: [
      {
        name: "Working at height",
        detail: "Tick this for ceilings, stairwells and any work off a hop-up, podium or tower.",
        keywords: ["ceiling", "stair", "ladder", "height", "hall"],
        usual: true,
      },
      {
        name: "Hot works",
        detail: "Tick this only if a heat gun or flame is proposed. Do not burn paint that may contain lead.",
        keywords: ["heat gun", "burn off", "hot works"],
      },
      {
        name: "Asbestos",
        detail: "Tick this for textured coatings. Do not sand or scrape them.",
        keywords: ["artex", "textured", "asbestos"],
      },
    ],
  },
  {
    trade: "GROUNDWORKS_LANDSCAPING",
    ppe: [
      "Safety boots with a midsole",
      "Gloves",
      "Eye protection when cutting",
      "Hearing protection when cutting",
      "Hi-vis where plant or the public are nearby",
      "Hard hat if anything can fall, or where the site requires one",
    ],
    method: [
      "Walk the site. Get service plans before you dig, and scan with a CAT and signal generator.",
      "Mark the dig and the exclusion zone. Agree where spoil will go, away from the edge.",
      "Hand dig near services. Do not enter an unsupported trench.",
      "Plant only with a trained operator. A banksman where people could walk into the swing.",
      "Cut paving and concrete wet where that is practical, with eye, hearing and dust protection.",
      "Make the site safe at the end of the day: cover or barrier any open dig, keys out of plant, and the public route clear.",
    ],
    hazards: [
      hazard(
        "ground-services",
        "Digging",
        "Striking a buried electric cable, gas pipe or other service",
        "Operatives and the public",
        3,
        5,
        "Plans before you dig, CAT and genny, marks on the ground, and hand digging near services. Follow HSE guidance on avoiding danger from underground services (HSG47). Permit to dig on a managed site.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "ground-collapse",
        "Excavations",
        "Collapse burying or crushing someone",
        "Operatives",
        3,
        5,
        "Batter the sides or support them. Keep spoil and plant back from the edge. Nobody enters an unsupported trench. A competent person inspects it.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "ground-plant",
        "Mini diggers, dumpers and rollers",
        "People struck by plant",
        "Operatives and the public",
        3,
        5,
        "Exclusion zone, trained operator, no passengers, and a banksman where the swing meets a path. Stop if the public can walk in.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "ground-handling",
        "Kerbs, bags and sleepers",
        "Musculoskeletal injury",
        "Operatives",
        3,
        3,
        "Machine or a team lift for heavy units. Use 25 kg cement bags where you can. Do not throw kerbs.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "ground-silica",
        "Cutting slabs, blocks and concrete",
        "Silica dust",
        "Operatives and neighbours",
        3,
        4,
        "Water suppression on the blade. FFP3 as well if dust still escapes. No dry cutting if a wet cut will do.",
        1,
        4,
        ["cut", "slab", "concrete", "disc", "silica", "chase"],
      ),
      hazard(
        "ground-cement",
        "Cement, mortar and concrete",
        "Dermatitis and cement burns",
        "Operatives",
        3,
        3,
        "Gloves, cover skin, wash promptly, and have clean water for eyes. COSHH. Follow the bag.",
        2,
        2,
        ["cement", "mortar", "concrete", "render"],
      ),
      hazard(
        "ground-public",
        "Open digs near a path, garden or school",
        "Someone falling into an excavation",
        "Public, including children",
        3,
        4,
        "Fence the dig. Cover or barrier it before you leave. Keep a clear route around the work.",
        2,
        3,
        ["garden", "public", "school", "pavement", "path"],
      ),
      asbestos("ground-asbestos", "Fragments in made ground and old garage roofs", ["asbestos", "garage"]),
    ],
    substances: [
      {
        name: "Cement",
        hazard: "Irritant and corrosive when wet. Chromium can cause dermatitis.",
        controls: "Gloves and sleeves. Wash skin. Eye wash to hand. Do not leave wet mortar in a boot.",
        keywords: [],
        usual: true,
      },
      {
        name: "Petrol or diesel for plant",
        hazard: "Fire. Skin irritation. Harmful to the ground if spilt.",
        controls: "Refuel with the engine off and cool. No smoking. Spill kit or a tray. Store cans upright and closed.",
        keywords: ["digger", "plant", "mower", "fuel"],
        usual: true,
      },
      {
        name: "Silica dust from cutting",
        hazard: "Silicosis and lung disease from respirable crystalline silica.",
        controls: "Wet cut. FFP3. Keep neighbours out of the dust.",
        keywords: ["cut", "slab", "concrete", "disc"],
      },
    ],
    permits: [
      {
        name: "Excavation and permit to dig",
        detail: "Required where you break ground. Plans, a scan, and hand digging near services. On a managed site, take their permit as well.",
        keywords: [],
        usual: true,
      },
      {
        name: "Working at height",
        detail: "Tick this if the job also puts someone up, for example a retaining wall or a fence on a bank.",
        keywords: ["ladder", "height", "scaffold", "wall"],
      },
      {
        name: "Asbestos",
        detail: "Tick this if the ground or an old outbuilding may contain asbestos. Stop if you find suspect board or lagging.",
        keywords: ["asbestos", "garage"],
      },
    ],
  },
  {
    trade: "GENERAL_BUILDING",
    ppe: [
      "Safety footwear",
      "Gloves",
      "Eye protection",
      "Hearing protection for cutting",
      "Hard hat and hi-vis where the site requires them",
      "FFP3 for dusty cutting",
    ],
    method: [
      "Walk the job with the client or main contractor. Confirm the scope, the programme and who else is on site.",
      "Where CDM 2015 applies, take the induction and follow the construction phase arrangements. On a small domestic job, still agree access, welfare and how you will keep the household safe.",
      "Protect routes through the property. Keep one clear way out.",
      "Isolate services before you open them up. Scan or ask before you chase or drill.",
      "Do the work in a sensible order so the site is stable at the end of each day. Working at height from a tower or scaffold, not from an improvised platform.",
      "Control dust at the tool. Bag waste. Do not leave nails, boards or open holes.",
      "Hand the area back clean, with services restored and the client shown what has changed.",
    ],
    hazards: [
      hazard(
        "build-height",
        "Work above the ground",
        "Fall from height",
        "Operatives",
        3,
        5,
        "Scaffold, tower or podium to suit the job. Inspect before use. Follow the Work at Height Regulations. Do not work from trestles on a stair.",
        1,
        5,
        [],
        true,
      ),
      hazard(
        "build-handling",
        "Materials and waste",
        "Musculoskeletal injury",
        "Operatives",
        3,
        3,
        "Team lifts, a barrow or a hoist. Do not carry sheet materials in a high wind. Keep routes clear.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "build-people",
        "Household or other trades in the area",
        "Someone hurt by tools, openings or dust",
        "Client, public and other workers",
        3,
        3,
        "Agree the work area. Cover or barrier holes. Tell other people before you create dust or isolate a supply.",
        2,
        2,
        [],
        true,
      ),
      hazard(
        "build-dust",
        "Cutting, chasing and sweeping",
        "Dust, including silica from concrete and mortar",
        "Operatives and occupants",
        3,
        4,
        "Water or extraction on the tool. FFP3 for dusty work. Vacuum, do not dry-sweep silica dust.",
        2,
        3,
        [],
        true,
      ),
      hazard(
        "build-hot",
        "Lead, bitumen or any open flame",
        "Fire",
        "The property and occupants",
        3,
        4,
        "Hot-works controls and a permit where the site requires one. Extinguisher, clear combustibles, and a fire watch.",
        2,
        3,
        ["torch", "lead", "bitumen", "hot works", "solder"],
      ),
      hazard(
        "build-electric",
        "Hidden cables and temporary supplies",
        "Electric shock",
        "Operatives",
        2,
        5,
        "Scanner or plans before you chase. Isolate and prove dead before you work on a circuit. Temporary supplies off the floor and through an RCD.",
        1,
        5,
        ["electric", "cable", "rewire", "chase", "consumer"],
      ),
      hazard(
        "build-dig",
        "Foundations, drains and any break of ground",
        "Collapse, or a strike on a buried service",
        "Operatives and the public",
        3,
        5,
        "Plans and a scan before you dig. Support the sides. Hand dig near services. Barrier the hole before you leave.",
        1,
        5,
        ["dig", "foundation", "drain", "trench", "excavat"],
      ),
      asbestos("build-asbestos", "Refurbishment of buildings, especially pre-2000", ["asbestos", "artex", "pre-2000", "refurb"]),
    ],
    substances: [
      {
        name: "Cement and mortar",
        hazard: "Dermatitis and burns when wet.",
        controls: "Gloves, wash, and eye water to hand. Follow the bag.",
        keywords: ["cement", "mortar", "brick", "render"],
        usual: true,
      },
      {
        name: "Adhesives and expanding foam",
        hazard: "Irritant vapour and skin sensitisation.",
        controls: "Ventilate, gloves, and the smallest amount that does the job.",
        keywords: ["adhesive", "foam", "glue"],
        usual: true,
      },
      {
        name: "Silica dust",
        hazard: "Lung disease from dust created by cutting masonry.",
        controls: "Wet cut or extract. FFP3. Do not dry-sweep.",
        keywords: ["cut", "chase", "concrete", "disc"],
      },
    ],
    permits: [
      {
        name: "Working at height",
        detail: "Tick this for any work where a fall could cause injury. Scaffold or a tower as the default.",
        keywords: ["ladder", "roof", "scaffold", "height", "stair", "loft"],
        usual: true,
      },
      {
        name: "Hot works",
        detail: "Tick this for torches, lead burning or any open flame.",
        keywords: ["torch", "hot works", "bitumen", "lead"],
      },
      {
        name: "Electrical isolation",
        detail: "Tick this when a circuit has to be dead. Lock off and prove dead.",
        keywords: ["electric", "cable", "rewire", "consumer"],
      },
      {
        name: "Excavation and permit to dig",
        detail: "Tick this before you break ground. Plans, a scan, and support for the sides.",
        keywords: ["dig", "foundation", "drain", "trench", "excavat"],
      },
      {
        name: "Asbestos",
        detail: "Tick this before intrusive work on a pre-2000 building, or if a survey has flagged materials.",
        keywords: ["asbestos", "artex", "pre-2000", "refurb"],
      },
    ],
  },
];

const BY_TRADE = new Map(PACKS.map((pack) => [pack.trade, pack]));

export function packFor(trade: RamsTradeValue): TradePack {
  const pack = BY_TRADE.get(trade);
  if (!pack) throw new Error(`No RAMS library for ${trade}`);
  return pack;
}

/** Matches a whole word or phrase, so "hot work" does not fire on "no hot works". */
export function keywordHits(keywords: string[], scope: string): number {
  const hay = scope.toLowerCase().replace(/\bno\s+hot\s+works\b/g, " ");
  return keywords.reduce((count, keyword) => {
    const needle = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`);
    return count + (pattern.test(hay) ? 1 : 0);
  }, 0);
}

export const HAZARD_CAP = 8;

export function selectHazards(pack: TradePack, scope: string): LibraryHazard[] {
  const core = pack.hazards.filter((item) => item.core);
  const extras = pack.hazards
    .filter((item) => !item.core && keywordHits(item.keywords, scope) > 0)
    .sort(
      (a, b) =>
        keywordHits(b.keywords, scope) - keywordHits(a.keywords, scope) || a.key.localeCompare(b.key),
    );
  const picked = [...core];
  for (const extra of extras) {
    if (picked.length >= HAZARD_CAP) break;
    picked.push(extra);
  }
  return picked;
}

export function selectSubstances(pack: TradePack, scope: string): LibrarySubstance[] {
  const usual = pack.substances.filter((item) => item.usual);
  const extra = pack.substances.filter((item) => !item.usual && keywordHits(item.keywords, scope) > 0);
  const picked = [...usual];
  for (const item of extra) {
    if (picked.length >= 5) break;
    if (!picked.some((have) => have.name === item.name)) picked.push(item);
  }
  return picked;
}

export function selectPermits(pack: TradePack, scope: string): Array<{ name: string; required: boolean; detail: string }> {
  return pack.permits.map((permit) => ({
    name: permit.name,
    detail: permit.detail,
    required: Boolean(permit.usual) || keywordHits(permit.keywords, scope) > 0,
  }));
}

export function selectMethod(pack: TradePack, scope: string): string[] {
  const opening = scope.trim()
    ? `Confirm the scope before you start: ${scope.trim()}`
    : "Confirm the scope with the client or main contractor before you start, and write it on this RAMS.";
  return [opening, ...pack.method, ...SHARED_CLOSING];
}

export type RamsHazardDraft = {
  libraryKey: string;
  activity: string;
  hazard: string;
  whoHarmed: string;
  likelihoodBefore: number;
  severityBefore: number;
  controls: string;
  likelihoodAfter: number;
  severityAfter: number;
};

export type RamsBody = {
  trade: RamsTradeValue;
  ppe: string;
  emergencyNotes: string;
  firstAidNotes: string;
  welfareNotes: string;
  hazards: RamsHazardDraft[];
  steps: Array<{ detail: string }>;
  substances: Array<{ name: string; hazard: string; controls: string }>;
  permits: Array<{ name: string; required: boolean; detail: string }>;
};

export function libraryKeys(trade: RamsTradeValue): string[] {
  return packFor(trade).hazards.map((item) => item.key);
}

/** Builds the draft from the library only. AI is not required. */
export function draftFromLibrary(trade: RamsTradeValue, scope: string): RamsBody {
  const pack = packFor(trade);
  return bodyFrom(pack, scope, selectHazards(pack, scope));
}

export function bodyFrom(pack: TradePack, scope: string, hazards: LibraryHazard[]): RamsBody {
  return {
    trade: pack.trade,
    ppe: pack.ppe.join("\n"),
    emergencyNotes: EMERGENCY_NOTES,
    firstAidNotes: FIRST_AID_NOTES,
    welfareNotes: WELFARE_NOTES,
    hazards: hazards.map((item) => ({
      libraryKey: item.key,
      activity: item.activity,
      hazard: item.hazard,
      whoHarmed: item.whoHarmed,
      likelihoodBefore: item.likelihoodBefore,
      severityBefore: item.severityBefore,
      controls: item.controls,
      likelihoodAfter: item.likelihoodAfter,
      severityAfter: item.severityAfter,
    })),
    steps: selectMethod(pack, scope).map((detail) => ({ detail })),
    substances: selectSubstances(pack, scope).map((item) => ({
      name: item.name,
      hazard: item.hazard,
      controls: item.controls,
    })),
    permits: selectPermits(pack, scope),
  };
}

export type HazardCompleter = (payload: {
  trade: string;
  scope: string;
  hazards: Array<{ key: string; activity: string; hazard: string; core: boolean }>;
}) => Promise<unknown>;

/**
 * AI may only return keys that already exist in the library.
 * Fewer than three known keys, unknown keys, or a failed call all fall back to the keyword draft.
 * Core hazards are kept even if the model omits them.
 */
export function keysFromModel(payload: unknown, allowed: Set<string>): string[] | null {
  if (!payload || typeof payload !== "object") return null;
  const keys = (payload as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return null;
  const picked = keys.filter((key): key is string => typeof key === "string" && allowed.has(key));
  const unique = [...new Set(picked)];
  if (unique.length < 3) return null;
  return unique;
}

export async function draftRamsBody(input: {
  trade: RamsTradeValue;
  scope: string;
  completer?: HazardCompleter | null;
}): Promise<{ body: RamsBody; source: "library" | "library-and-ai" }> {
  const pack = packFor(input.trade);
  const library = draftFromLibrary(input.trade, input.scope);
  if (!input.completer) return { body: library, source: "library" };
  try {
    const raw = await input.completer({
      trade: ramsTradeLabel(input.trade),
      scope: input.scope,
      hazards: pack.hazards.map((item) => ({
        key: item.key,
        activity: item.activity,
        hazard: item.hazard,
        core: Boolean(item.core),
      })),
    });
    const allowed = new Set(pack.hazards.map((item) => item.key));
    const keys = keysFromModel(raw, allowed);
    if (!keys) return { body: library, source: "library" };
    const core = pack.hazards.filter((item) => item.core).map((item) => item.key);
    const merged = [...core, ...keys.filter((key) => !core.includes(key))].slice(0, HAZARD_CAP);
    const byKey = new Map(pack.hazards.map((item) => [item.key, item]));
    const hazards = merged.map((key) => byKey.get(key)).filter((item): item is LibraryHazard => Boolean(item));
    return { body: bodyFrom(pack, input.scope, hazards), source: "library-and-ai" };
  } catch {
    return { body: library, source: "library" };
  }
}

export const LIBRARY_NOTE =
  "Hazards, controls and the method come from Quotestick's checked library for this trade. Wording is a starting point. Change it so it matches this site. The library is not a substitute for your own check.";

export { RAMS_DISCLAIMER };
