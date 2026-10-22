// Reporter screen text in English, Luganda and Kiswahili.
// Luganda and Kiswahili are drafts: have a native speaker check them before launch.
// Issue types are saved in English so the dashboard and hotspot map keep working;
// only the label shown to the reporter is translated.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "lg", label: "Luganda" },
  { code: "sw", label: "Kiswahili" },
];

export const ISSUE_LABELS = {
  "Rubbish heap (kasasiro)": { en: "Rubbish heap (kasasiro)", lg: "Entuumu ya kasasiro", sw: "Rundo la taka" },
  "Plastic waste": { en: "Plastic waste", lg: "Kasasiro wa pulasitiika", sw: "Taka za plastiki" },
  "Sewer spill": { en: "Sewer spill", lg: "Kazambi ayiise", sw: "Maji taka yanayovuja" },
  "Blocked drainage": { en: "Blocked drainage", lg: "Omukutu gw'amazzi oguzibiddwa", sw: "Mtaro ulioziba" },
  "Open burning / smoke": { en: "Open burning / smoke", lg: "Okwokya kasasiro / omukka", sw: "Uchomaji wazi / moshi" },
  "Industrial waste / chemicals": {
    en: "Industrial waste / chemicals",
    lg: "Kasasiro w'amakolero / eddagala",
    sw: "Taka za viwandani / kemikali",
  },
  "Vegetation loss": { en: "Vegetation loss", lg: "Okusaanyaawo ebimera n'emiti", sw: "Upotevu wa mimea na miti" },
  "Wetland encroachment": { en: "Wetland encroachment", lg: "Okwesenza mu ntobazzi", sw: "Uvamizi wa ardhioevu" },
  "Wildlife distress": { en: "Wildlife distress", lg: "Ebisolo by'omu nsiko biri mu buzibu", sw: "Wanyamapori walio hatarini" },
  Other: { en: "Other", lg: "Ebirala", sw: "Mengineyo" },
};

const STRINGS = {
  en: {
    language: "Language",
    officerLogin: "Officer login",
    dashboard: "NEMA dashboard",
    title: "Report pollution",
    intro:
      "Capture pollution or damage to the environment, in a wetland, street, market or anywhere else, and share the location with NEMA.",
    photo: "Photo",
    photoAlt: "Selected photo of the issue",
    issueType: "Type of issue",
    location: "Location",
    waitingGps: "Waiting for GPS…",
    gpsGood: "Good GPS precision",
    gpsOk: "Acceptable GPS precision",
    gpsWeak: "Weak GPS precision",
    gpsNone: "GPS accuracy unavailable",
    refresh: "Refresh location",
    whatSaw: "What did you see?",
    notePlaceholder:
      "Describe the issue: smells, runoff, blocked drains, rubbish, wildlife concerns, or anything you think NEMA should inspect.",
    needLocation: "Please allow location access before sending the report.",
    sendFailed: "Could not send the report.",
    duplicatePhoto: "This photo has already been sent to NEMA. Please take a new photo of what you see.",
    badPhoto: "This photo could not be read. Please take it again.",
    offline: "Could not reach the server. Check your connection and try again.",
    geoUnavailable: "This device cannot get your location. Please turn on GPS and allow location access.",
    sending: "Sending…",
    send: "Send report",
    received: "Report received",
    thanks: "Thanks for your alert. NEMA will review this report and update you once a decision is made.",
    caseRef: "Case reference",
    keepRef: "Keep this reference if you need to follow up on the report.",
  },
  lg: {
    language: "Olulimi",
    officerLogin: "Abakozi ba NEMA: yingira",
    dashboard: "Dashibodi ya NEMA",
    title: "Loopa obucaafu",
    intro:
      "Kuba ekifaananyi ky'obucaafu oba okwonoonebwa kw'obutonde, mu ntobazzi, ku luguudo, mu katale oba wonna, era oweereze NEMA ekifo we kiri.",
    photo: "Ekifaananyi",
    photoAlt: "Ekifaananyi ky'ekizibu",
    issueType: "Ekika ky'ekizibu",
    location: "Ekifo",
    waitingGps: "Tulindirira GPS…",
    gpsGood: "GPS entuufu",
    gpsOk: "GPS ekola ekimala",
    gpsWeak: "GPS nnafu",
    gpsNone: "Obutuufu bwa GPS tebumanyiddwa",
    refresh: "Zza buggya ekifo",
    whatSaw: "Kiki ky'olabye?",
    notePlaceholder:
      "Nnyonnyola ekizibu: evvumbe, amazzi agakulukuta, emikutu egizibiddwa, kasasiro, ebisolo, oba ekirala kyonna NEMA ky'esaanidde okukebera.",
    needLocation: "Kkiriza app okumanya ekifo w'oli nga tonnaweereza lipoota.",
    sendFailed: "Lipoota tesobodde kugenda.",
    duplicatePhoto: "Ekifaananyi kino kyamala dda okuweerezebwa eri NEMA. Kuba ekifaananyi ekipya eky'ekyo ky'olaba.",
    badPhoto: "Ekifaananyi kino tekisobose kusomebwa. Kiddemu okukuba.",
    offline: "Tetusobodde kutuuka ku seva. Kebera intaneti yo oddemu ogezeeko.",
    geoUnavailable: "Essimu eno tesobola kumanya w'oli. Ggulawo GPS era okkirize app okumanya ekifo.",
    sending: "Kiweerezebwa…",
    send: "Weereza lipoota",
    received: "Lipoota efunye",
    thanks: "Webale okutumanyisa. NEMA ejja kwekenneenya lipoota eno era ekutegeeze nga emaze okusalawo.",
    caseRef: "Ennamba ya lipoota",
    keepRef: "Kuuma ennamba eno singa oyagala okugoberera lipoota yo.",
  },
  sw: {
    language: "Lugha",
    officerLogin: "Kuingia kwa maafisa",
    dashboard: "Dashibodi ya NEMA",
    title: "Ripoti uchafuzi",
    intro:
      "Piga picha ya uchafuzi au uharibifu wa mazingira, katika ardhioevu, barabarani, sokoni au popote pengine, na utume mahali ulipo kwa NEMA.",
    photo: "Picha",
    photoAlt: "Picha ya tatizo uliyochagua",
    issueType: "Aina ya tatizo",
    location: "Mahali",
    waitingGps: "Inasubiri GPS…",
    gpsGood: "Usahihi mzuri wa GPS",
    gpsOk: "Usahihi wa GPS unakubalika",
    gpsWeak: "Usahihi wa GPS ni dhaifu",
    gpsNone: "Usahihi wa GPS haupatikani",
    refresh: "Onyesha upya mahali",
    whatSaw: "Uliona nini?",
    notePlaceholder:
      "Eleza tatizo: harufu, maji yanayotiririka, mitaro iliyoziba, taka, wanyamapori, au chochote unachofikiri NEMA inapaswa kukagua.",
    needLocation: "Tafadhali ruhusu ufikiaji wa mahali kabla ya kutuma ripoti.",
    sendFailed: "Ripoti haikuweza kutumwa.",
    duplicatePhoto: "Picha hii tayari imetumwa kwa NEMA. Tafadhali piga picha mpya ya unachokiona.",
    badPhoto: "Picha hii haikuweza kusomwa. Tafadhali ipige tena.",
    offline: "Imeshindwa kufikia seva. Angalia muunganisho wako na ujaribu tena.",
    geoUnavailable: "Kifaa hiki hakiwezi kupata mahali ulipo. Tafadhali washa GPS na uruhusu ufikiaji wa mahali.",
    sending: "Inatuma…",
    send: "Tuma ripoti",
    received: "Ripoti imepokelewa",
    thanks: "Asante kwa taarifa yako. NEMA itakagua ripoti hii na kukujulisha uamuzi utakapofanywa.",
    caseRef: "Namba ya kesi",
    keepRef: "Hifadhi namba hii ikiwa utahitaji kufuatilia ripoti.",
  },
};

export function translator(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key) => table[key] ?? STRINGS.en[key] ?? key;
}

export function issueLabel(type, lang) {
  return ISSUE_LABELS[type]?.[lang] || ISSUE_LABELS[type]?.en || type;
}

const STORE_KEY = "kuuma-obutonde-lang";

// Saved choice first, then the phone's language, then English.
export function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  if (/^sw/i.test(nav)) return "sw";
  if (/^lg/i.test(nav)) return "lg";
  return "en";
}

export function saveLanguage(code) {
  try {
    localStorage.setItem(STORE_KEY, code);
  } catch {}
}
