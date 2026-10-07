import type { PersonRole } from "@prisma/client";

export type CardFields = {
  name?: string;
  title?: string;
  company?: string;
  mobilePhone?: string;
  officePhone?: string;
  email?: string;
  website?: string;
  address?: string;
  role?: PersonRole;
  languages?: string[];
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const PHONE_RE =
  /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?/gi;
const URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|us|co|biz|info|law|legal|pro|io|homes|realty)(?:\/[^\s]*)?/i;
const ZIP_LINE_RE = /\b(?:[A-Z]{2}|Florida)\.?,?\s+\d{5}(?:-\d{4})?\b/i;
const STREET_RE =
  /^\d{1,6}[a-z]?\s+.*\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|pl|place|pkwy|parkway|hwy|highway|ter|terrace|cir|circle|trl|trail|sq|square|plaza|suite|ste|unit|#)\b/i;

const TITLE_RE =
  /\b(?:manager|adjuster|president|vice president|vp|owner|director|estimator|engineer|attorney|esq\.?|counsel|partner|principal|founder|co-founder|ceo|coo|cfo|cto|supervisor|coordinator|specialist|consultant|inspector|technician|representative|agent|associate|superintendent|foreman|examiner|appraiser|umpire|broker|realtor|administrator|secretary|treasurer|lcam|cam|officer|executive|analyst|assistant|lead|head)\b/i;

const COMPANY_RE =
  /\b(?:inc|llc|l\.l\.c|corp|corporation|co\.|company|group|services|restoration|roofing|construction|contractors?|builders|management|properties|property|realty|adjusting|adjusters|law|legal|engineering|engineers|associates|insurance|mitigation|plumbing|solutions|enterprises|partners|pllc|ltd|association|condominium|hoa|claims|consulting|agency|firm|holdings|homes|remodeling|electric|mechanical)\b/i;

const LABEL_MOBILE = /(?:cell|mobile|mob|cel|c|m)\s*[:.)\-]?\s*$/i;
const LABEL_FAX = /(?:fax|f)\s*[:.)\-]?\s*$/i;
const LABEL_OFFICE =
  /(?:office|off|tel|phone|ph|direct|dir|main|work|o|t|p|d)\s*[:.)\-]?\s*$/i;

export function formatPhone(raw: string): string {
  const ext = raw.match(/(?:x|ext\.?)\s*(\d{1,5})\s*$/i)?.[1];
  let digits = raw.replace(/(?:x|ext\.?)\s*\d{1,5}\s*$/i, "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return raw.trim();
  const base = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return ext ? `${base} x${ext}` : base;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Llc|Pllc|Inc|Hoa|Pa|Pe|Vp|Ceo|Coo|Cfo|Lcam|Cam)\b/g, (m) => m.toUpperCase());
}

function normalizeCase(value: string) {
  const letters = value.replace(/[^a-z]/gi, "");
  return letters && letters === letters.toUpperCase() ? titleCase(value) : value;
}

/** OCR often reads "@" as ©, ®, (a) or a lone O/Q/0 between the user and the domain. */
const MISREAD_AT_RE =
  /([a-z0-9._%+-]{2,})\s*(?:[©®]|\(a\)|\s[oOQ0a]\s)\s*([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|us|co|biz|info|law|legal|pro|io|gov|edu))\b/i;

/** A line holding only "user domain.com" (lowercase, "@" lost entirely). */
const DROPPED_AT_RE =
  /^\s*((?!www\b)[a-z0-9][a-z0-9._%+-]+)\s{1,3}([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|us|co|biz|info|law|legal|pro|io|gov|edu))\s*$/;

function cleanLine(line: string) {
  const repaired = line.includes("@")
    ? line
    : line.replace(MISREAD_AT_RE, "$1@$2").replace(DROPPED_AT_RE, "$1@$2");
  return repaired
    .replace(/[|¦•·]/g, " ")
    .replace(/\s*@\s*/g, "@")
    .replace(/\bL[I1l]C\b/g, "LLC")
    .replace(/\s{2,}/g, " ")
    .replace(/^[^a-z0-9(+#]+|[^a-z0-9).]+$/gi, "")
    .trim();
}

function remainder(line: string) {
  return line.replace(/[^a-z0-9]/gi, "");
}

const CREDENTIAL_SUFFIX_RE =
  /(?:,\s*(?:esq\.?|p\.?\s?e\.?|lcam|cam|cpcu|aic|cpa|mba|jr\.?|sr\.?|iii|ii|ra|cgc|ccc))+\s*$/i;

function stripCredentials(line: string) {
  return line.replace(CREDENTIAL_SUFFIX_RE, "").trim();
}

function looksLikeName(line: string) {
  if (/\d|@/.test(line)) return false;
  const bare = stripCredentials(line);
  if (TITLE_RE.test(bare) || COMPANY_RE.test(bare)) return false;
  const words = bare.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü.'-]*$/.test(w));
}

function suggestRole(text: string): PersonRole | undefined {
  const t = text.toLowerCase();
  if (/public adjust/.test(t)) return "PUBLIC_ADJUSTER";
  if (/independent adjust/.test(t)) return "INDEPENDENT_ADJUSTER";
  if (
    /(?:field|desk|staff|property|claims?|large loss)\s+adjuster|claims? (?:representative|specialist|examiner|professional)/.test(t)
  )
    return "CARRIER_ADJUSTER";
  if (/\battorney|\besq\b|\blaw (?:firm|office|group)|\blawyers?\b|\bcounsel\b/.test(t)) return "ATTORNEY";
  if (/\bengineer|\bp\.e\.(?:\s|$)/.test(t)) return "ENGINEER";
  if (/umpire/.test(t)) return "UMPIRE";
  if (/apprais/.test(t)) return "APPRAISER";
  if (/board (?:member|president|director)|\bhoa\b|homeowners? association/.test(t))
    return "ASSOCIATION_BOARD";
  if (/property manag|community association|association manag|\blcam\b|\bcam\b|property management/.test(t))
    return "PROPERTY_MANAGER";
  if (/mitigation|restoration|water damage|remediation|\bdrying\b|dry[- ]?out/.test(t)) return "MITIGATION";
  if (/roof|construction|contractor|builders|\bcgc\d*|\bccc\d*|remodel/.test(t)) return "CONTRACTOR";
  if (/insurance agen|\bagency\b/.test(t)) return "INSURANCE_AGENT";
  return undefined;
}

function detectLanguages(text: string): string[] {
  const langs = ["English"];
  if (/espa[nñ]ol|se habla|hablamos|spanish/i.test(text)) langs.push("Spanish");
  if (/portugu[eê]s|falamos/i.test(text)) langs.push("Portuguese");
  if (/krey[oò]l|creole|nou pale/i.test(text)) langs.push("Haitian Creole");
  if (/fran[cç]ais|parlons/i.test(text)) langs.push("French");
  return langs;
}

/** Best-effort extraction from OCR text. Every field is a suggestion to review. */
export function parseBusinessCard(rawText: string): CardFields {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter((l) => remainder(l).length >= 2);
  const used = new Set<number>();
  const out: CardFields = {};

  lines.forEach((line, i) => {
    let rest = line;

    const email = line.match(EMAIL_RE)?.[0];
    if (email && !out.email) {
      out.email = email.toLowerCase();
      rest = rest.replace(email, " ");
    }

    for (const match of Array.from(line.matchAll(PHONE_RE))) {
      const before = line.slice(0, match.index ?? 0);
      const phone = formatPhone(match[0]);
      rest = rest.replace(match[0], " ");
      if (LABEL_FAX.test(before)) continue;
      if (LABEL_MOBILE.test(before) && !out.mobilePhone) out.mobilePhone = phone;
      else if (LABEL_OFFICE.test(before) && !out.officePhone) out.officePhone = phone;
      else if (!out.mobilePhone) out.mobilePhone = phone;
      else if (!out.officePhone) out.officePhone = phone;
    }

    if (!out.website) {
      const url = rest.match(URL_RE)?.[0];
      if (url && !url.includes("@")) {
        out.website = url.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
        rest = rest.replace(url, " ");
      }
    }

    rest = rest.replace(
      /\b(?:cell|mobile|mob|cel|office|off|tel|phone|ph|direct|fax|main|work|email|e-mail|web|[cmotpdfe])\s*[:.]/gi,
      " "
    );
    if (remainder(rest).length < 3) used.add(i);
  });

  const zipIdx = lines.findIndex((l, i) => !used.has(i) && ZIP_LINE_RE.test(l));
  if (zipIdx >= 0) {
    const zipLine = lines[zipIdx];
    const prev = zipIdx > 0 ? lines[zipIdx - 1] : "";
    if (STREET_RE.test(zipLine) || /^\d{2,6}\s/.test(zipLine)) {
      out.address = zipLine;
    } else if (prev && !used.has(zipIdx - 1) && (STREET_RE.test(prev) || /^\d{2,6}\s/.test(prev))) {
      out.address = `${prev}, ${zipLine}`;
      used.add(zipIdx - 1);
    } else {
      out.address = zipLine;
    }
    used.add(zipIdx);
  } else {
    const streetIdx = lines.findIndex((l, i) => !used.has(i) && STREET_RE.test(l));
    if (streetIdx >= 0) {
      out.address = lines[streetIdx];
      used.add(streetIdx);
    }
  }

  const titleIdx = lines.findIndex(
    (l, i) =>
      !used.has(i) &&
      TITLE_RE.test(l) &&
      !/\d|@/.test(l) &&
      !looksLikeName(l) &&
      l.split(/\s+/).length <= 7
  );

  const companyIdx = lines.findIndex(
    (l, i) => !used.has(i) && i !== titleIdx && COMPANY_RE.test(l) && !/@/.test(l)
  );
  if (companyIdx >= 0) {
    let company = lines[companyIdx];
    const prevIdx = companyIdx - 1;
    const prev = prevIdx >= 0 ? lines[prevIdx] : "";
    if (
      prev &&
      !used.has(prevIdx) &&
      prevIdx !== titleIdx &&
      company.split(/\s+/).length <= 2 &&
      prev.split(/\s+/).length <= 3 &&
      /^[A-Z0-9&' .-]+$/.test(prev) &&
      /[A-Z]{3,}/.test(prev)
    ) {
      company = `${prev} ${company}`;
      used.add(prevIdx);
    }
    const nextIdx = companyIdx + 1;
    const next = nextIdx < lines.length ? lines[nextIdx] : "";
    if (
      next &&
      !used.has(nextIdx) &&
      nextIdx !== titleIdx &&
      !looksLikeName(next) &&
      next.split(/\s+/).length <= 4 &&
      /^[A-Z0-9&',. -]+$/.test(next) &&
      COMPANY_RE.test(next)
    ) {
      company = `${company} ${next}`;
      used.add(nextIdx);
    }
    out.company = normalizeCase(company);
    used.add(companyIdx);
  }

  if (titleIdx >= 0 && titleIdx !== companyIdx) {
    out.title = normalizeCase(lines[titleIdx]);
    used.add(titleIdx);
  }

  const emailLocal = out.email?.split("@")[0].toLowerCase().replace(/[^a-z]/g, "") ?? "";
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (used.has(i) || !looksLikeName(line)) continue;
    let score = 10 - Math.min(i, 8);
    if (titleIdx >= 0 && (i === titleIdx - 1 || i === titleIdx + 1)) score += 6;
    const parts = line.toLowerCase().split(/\s+/).map((p) => p.replace(/[^a-z]/g, ""));
    if (emailLocal && parts.some((p) => p.length > 2 && emailLocal.includes(p))) score += 8;
    if (score > bestScore) {
      bestIdx = i;
      bestScore = score;
    }
  }
  const emailUser = out.email?.split("@")[0] ?? "";
  if (bestIdx >= 0) {
    const line = lines[bestIdx];
    if (/,\s*esq\.?/i.test(line)) out.title ??= "Attorney";
    out.name = normalizeCase(stripCredentials(line));
    used.add(bestIdx);
  } else if (/[._]/.test(emailUser)) {
    out.name = titleCase(emailUser.replace(/[._]+/g, " ").replace(/\d/g, "").trim());
  }

  out.role = suggestRole(rawText);
  out.languages = detectLanguages(rawText);
  return out;
}
